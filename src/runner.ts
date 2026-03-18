import axios from 'axios';
import { Logger } from 'pino';
import { EspnClient } from './espn/client.js';
import { parseScoreboard } from './espn/scoreboard-parser.js';
import { mergeSummaryIntoGame } from './espn/summary-parser.js';
import { StateStore } from './state/store.js';
import { AlertRule } from './rules/rule.js';
import { PlayRule } from './rules/play-rule.js';
import { CloseGameRule } from './rules/close-game.js';
import { UpsetRule } from './rules/upset.js';
import { ScoringRunRule } from './rules/scoring-run.js';
import { BlowoutRule } from './rules/blowout.js';
import { ComebackRule } from './rules/comeback.js';
import { OvertimeRule } from './rules/overtime.js';
import { ScoringMilestoneRule } from './rules/scoring-milestone.js';
import { TripleDoubleRule } from './rules/triple-double.js';
import { QuadrupleDoubleRule } from './rules/quadruple-double.js';
import { FiveByFiveRule } from './rules/five-by-five.js';
import { GooseEggRule } from './rules/goose-egg.js';
import { BigShotRule } from './rules/big-shot.js';
import { Notifier } from './notifiers/notifier.js';
import { formatTweet } from './formatters/tweet.js';
import { Game, Play, isLive, isFinished } from './types/game.js';
import { Alert } from './types/alert.js';

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500 } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

const SCOREBOARD_RULES: AlertRule[] = [
  new CloseGameRule(),
  new UpsetRule(),
  new ScoringRunRule(),
  new BlowoutRule(),
  new ComebackRule(),
  new OvertimeRule(),
];

const BOX_SCORE_RULES: AlertRule[] = [
  new ScoringMilestoneRule(),
  new TripleDoubleRule(),
  new QuadrupleDoubleRule(),
  new FiveByFiveRule(),
  new GooseEggRule(),
];

const PLAY_RULES: PlayRule[] = [new BigShotRule()];

export class Runner {
  private espn: EspnClient;
  private readonly gameCache = new Map<string, Game>();
  private readonly watchers = new Map<string, NodeJS.Timeout>();
  private readonly inFlight = new Set<string>();
  private readonly activePollIntervalMs: number;

  constructor(
    private readonly store: StateStore,
    private readonly notifiers: Notifier[],
    private readonly logger: Logger,
    private readonly dryRun: boolean,
    activePollIntervalSeconds: number,
    private readonly healthcheckUrl?: string,
  ) {
    this.espn = new EspnClient();
    this.activePollIntervalMs = activePollIntervalSeconds * 1000;
  }

  /**
   * Scoreboard tier — runs every pollIntervalMinutes. Fetches scoreboard,
   * updates game cache, and manages per-game watcher lifecycle.
   */
  async pollScoreboard(): Promise<void> {
    const games = await this.fetchGames();
    if (!games) return;

    // Update game cache with fresh scoreboard data, preserving summary-enriched fields
    for (const game of games) {
      const cached = this.gameCache.get(game.id);
      if (cached) {
        this.gameCache.set(game.id, {
          ...game,
          plays: cached.plays,
          players: cached.players,
          lastProcessedSeq: cached.lastProcessedSeq,
        });
      } else {
        this.gameCache.set(game.id, game);
      }
    }

    // Identify newly live games (not yet watched)
    const newLiveGames = games.filter((g) => isLive(g) && !this.watchers.has(g.id));

    // Restore play cursors for newly live games from persisted state
    await Promise.allSettled(
      newLiveGames.map(async (game) => {
        try {
          const saved = await this.store.loadGame(game.id);
          if (saved?.lastProcessedSeq !== undefined) {
            const cached = this.gameCache.get(game.id);
            if (cached) {
              this.gameCache.set(game.id, { ...cached, lastProcessedSeq: saved.lastProcessedSeq });
            }
          }
        } catch (err) {
          this.logger.warn({ err, gameId: game.id }, 'Failed to load saved play cursor');
        }
      })
    );

    // Start watchers for newly live games and fire an immediate poll
    for (const game of newLiveGames) {
      this.logger.info({ gameId: game.id }, 'Starting game watcher');
      this.startWatcher(game.id);
      // Fire-and-forget: errors logged by pollGame; inFlight prevents overlap with interval ticks
      void this.pollGame(game.id).catch((err) =>
        this.logger.error({ err, gameId: game.id }, 'Initial game poll error')
      );
    }

    // Note: do NOT stop watchers here for finished games. The game watcher self-terminates
    // after its final processGame() call, which ensures close-game-final and other end-of-game
    // rules are evaluated before the watcher shuts down. Stopping from here would evict the game
    // from the cache, causing pollGame() to return early without evaluating final rules.

    await this.pingHealthcheck();
  }

  /**
   * Single-shot poll — fetches scoreboard then polls all active games once.
   * Used for --single-run mode (no watchers started).
   */
  async poll(): Promise<void> {
    const games = await this.fetchGames();
    if (!games) return;

    const activeGames = games.filter((g) => isLive(g) || isFinished(g));
    if (activeGames.length === 0) {
      this.logger.info('No active games');
      await this.pingHealthcheck();
      return;
    }

    this.logger.info({ count: activeGames.length }, 'Active games found');

    // Populate cache so pollGame can find the games
    for (const game of activeGames) {
      this.gameCache.set(game.id, game);
    }

    await Promise.allSettled(activeGames.map((g) => this.pollGame(g.id)));

    await this.pingHealthcheck();
  }

  /** Stop all active game watchers — call on graceful shutdown. */
  shutdown(): void {
    for (const gameId of [...this.watchers.keys()]) {
      this.stopWatcher(gameId);
    }
  }

  /** Fetches and parses the ESPN scoreboard. Returns null if the fetch fails. */
  private async fetchGames(): Promise<Game[] | null> {
    this.logger.info('Polling ESPN scoreboard...');
    try {
      const scoreboard = await withRetry(() => this.espn.fetchScoreboard());
      const games = parseScoreboard(scoreboard);
      this.logger.debug({ count: games.length }, 'Parsed games');
      return games;
    } catch (err) {
      this.logger.error({ err }, 'Failed to fetch scoreboard');
      return null;
    }
  }

  private startWatcher(gameId: string): void {
    if (this.watchers.has(gameId)) return;
    const interval = setInterval(() => {
      // Fire-and-forget: errors logged inside pollGame; inFlight prevents overlap
      void this.pollGame(gameId).catch((err) =>
        this.logger.error({ err, gameId }, 'Game watcher error')
      );
    }, this.activePollIntervalMs);
    this.watchers.set(gameId, interval);
  }

  private stopWatcher(gameId: string): void {
    const interval = this.watchers.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.watchers.delete(gameId);
      this.gameCache.delete(gameId);
      this.logger.info({ gameId }, 'Game watcher stopped');
    }
  }

  /**
   * Game watcher tier — fetches game summary, advances play cursor,
   * evaluates all rules, and sends alerts.
   */
  async pollGame(gameId: string): Promise<void> {
    if (this.inFlight.has(gameId)) {
      this.logger.debug({ gameId }, 'Game poll skipped — already in flight');
      return;
    }
    this.inFlight.add(gameId);

    try {
      const cachedGame = this.gameCache.get(gameId);
      if (!cachedGame) {
        this.logger.warn({ gameId }, 'No cached game found — skipping poll');
        return;
      }

      // Fetch summary and merge into cached game snapshot
      let game = cachedGame;
      try {
        const summary = await withRetry(() => this.espn.fetchGameSummary(gameId));
        game = mergeSummaryIntoGame(cachedGame, summary);
      } catch (err) {
        this.logger.warn({ err, gameId }, 'Failed to fetch game summary');
      }

      // Play cursor: identify plays not yet processed
      const allPlays = game.plays ?? [];
      let newPlays: Play[];

      if (allPlays.length > 0) {
        const maxSeq = allPlays.reduce((max, p) => Math.max(max, p.sequenceNumber), -1);

        if (cachedGame.lastProcessedSeq === undefined) {
          // First time seeing this game — skip retroactive plays, start cursor from now
          newPlays = [];
          game = { ...game, lastProcessedSeq: maxSeq };
        } else if (maxSeq < cachedGame.lastProcessedSeq) {
          // Sequence regressed (ESPN data correction) — reset cursor, reprocess all
          this.logger.warn({ gameId, lastSeq: cachedGame.lastProcessedSeq, maxSeq }, 'Play sequence regressed — resetting cursor');
          newPlays = allPlays;
          game = { ...game, lastProcessedSeq: maxSeq };
        } else {
          newPlays = allPlays.filter((p) => p.sequenceNumber > cachedGame.lastProcessedSeq!);
          if (newPlays.length > 0) {
            game = { ...game, lastProcessedSeq: maxSeq };
          }
        }
      } else {
        newPlays = [];
      }

      // Update cache with latest game state (including updated cursor)
      this.gameCache.set(gameId, game);

      await this.processGame(game, newPlays);

      // Stop watcher once game finishes — final evaluation already ran above
      if (isFinished(game)) {
        this.stopWatcher(gameId);
      }
    } finally {
      this.inFlight.delete(gameId);
    }
  }

  private async processGame(game: Game, newPlays: Play[]): Promise<void> {
    const allAlerts: Alert[] = [];

    // Run scoreboard rules
    for (const rule of SCOREBOARD_RULES) {
      try {
        allAlerts.push(...rule.evaluate(game));
      } catch (err) {
        this.logger.warn({ err, rule: rule.name, gameId: game.id }, 'Rule evaluation error');
      }
    }

    // Run box score rules (only if player data is available)
    if (game.players && game.players.length > 0) {
      for (const rule of BOX_SCORE_RULES) {
        try {
          allAlerts.push(...rule.evaluate(game));
        } catch (err) {
          this.logger.warn({ err, rule: rule.name, gameId: game.id }, 'Rule evaluation error');
        }
      }
    }

    // Run play-level rules on new plays only
    for (const play of newPlays) {
      for (const rule of PLAY_RULES) {
        try {
          const alert = rule.evaluate(play, game);
          if (alert) allAlerts.push(alert);
        } catch (err) {
          this.logger.warn({ err, rule: rule.name, gameId: game.id }, 'Play rule evaluation error');
        }
      }
    }

    if (allAlerts.length === 0) {
      await this.store.saveGame(game);
      return;
    }

    // Deduplicate against fired alerts
    const newAlerts = await this.store.filterNewAlerts(allAlerts);

    this.logger.info(
      { gameId: game.id, total: allAlerts.length, new: newAlerts.length },
      'Alerts evaluated'
    );

    // Send new alerts
    for (const alert of newAlerts) {
      const tweetText = formatTweet(alert);

      if (this.dryRun) {
        this.logger.info({ alertId: alert.id, tweetText }, '[DRY RUN] Would send alert');
      } else {
        let atLeastOneSent = this.notifiers.length === 0;
        await Promise.allSettled(
          this.notifiers.map(async (notifier) => {
            try {
              await notifier.send(alert, tweetText);
              atLeastOneSent = true;
            } catch (err) {
              this.logger.error({ err, alertId: alert.id }, 'Notifier error');
            }
          })
        );
        // Only mark fired if at least one notifier succeeded — failed sends will retry next poll
        if (atLeastOneSent) {
          await this.store.markAlertFired(alert);
        } else {
          this.logger.warn({ alertId: alert.id }, 'All notifiers failed — alert will retry next poll');
        }
      }
    }

    // Always save game snapshot (persists lastProcessedSeq)
    await this.store.saveGame(game);
  }

  private async pingHealthcheck(): Promise<void> {
    if (!this.healthcheckUrl) return;
    try {
      await axios.get(this.healthcheckUrl, { timeout: 5000 });
      this.logger.debug('Healthcheck pinged');
    } catch (err) {
      this.logger.warn({ err }, 'Healthcheck ping failed');
    }
  }
}
