import axios from 'axios';
import { Logger } from 'pino';
import { EspnClient } from './espn/client.js';
import { parseScoreboard } from './espn/scoreboard-parser.js';
import { mergeSummaryIntoGame } from './espn/summary-parser.js';
import { StateStore } from './state/store.js';
import { SCOREBOARD_RULES, BOX_SCORE_RULES, PLAY_RULES } from './rules/index.js';
import { postDailySummary } from './summary/daily-summary.js';
import { Notifier } from './notifiers/notifier.js';
import { formatTweet } from './formatters/tweet.js';
import { Game, Play, isLive, isFinished } from './types/game.js';
import { Alert } from './types/alert.js';

export function earliestEtDate(games: Game[]): string {
  const earliest = games.map((g) => g.startTime).sort()[0]!;
  return new Date(earliest).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500, logger, context }: { retries?: number; baseDelayMs?: number; logger?: Logger; context?: string } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger?.warn({ attempt: attempt + 1, retries, err: errMsg, context }, `Retrying (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}


export class Runner {
  private espn: EspnClient;
  private readonly gameCache = new Map<string, Game>();
  private readonly watchers = new Map<string, NodeJS.Timeout>();
  private readonly inFlight = new Set<string>();
  private readonly skipCounts = new Map<string, number>();
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

    await this.maybePostDailySummary();
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

  /**
   * Computes the optimal delay before the next scoreboard poll.
   * When no games are live and the next tip-off is far away, returns a longer
   * delay so we sleep until closer to that game's start time.
   * Never returns less than configuredIntervalMs.
   */
  nextScoreboardPollMs(configuredIntervalMs: number): number {
    const BUFFER_MS = 5 * 60 * 1000; // poll 5 min before scheduled start

    const cachedGames = [...this.gameCache.values()];
    const hasLiveGame = cachedGames.some((g) => g.status === 'in');
    if (hasLiveGame) return configuredIntervalMs;

    const preGames = cachedGames.filter((g) => g.status === 'pre');
    if (preGames.length === 0) return configuredIntervalMs;

    const now = Date.now();
    const earliestStartMs = Math.min(...preGames.map((g) => new Date(g.startTime).getTime()));
    const msUntilPoll = earliestStartMs - BUFFER_MS - now;

    return msUntilPoll > configuredIntervalMs ? msUntilPoll : configuredIntervalMs;
  }

  /** Fetches and parses the ESPN scoreboard. Returns null if the fetch fails. */
  private async fetchGames(): Promise<Game[] | null> {
    this.logger.info('Polling ESPN scoreboard...');
    try {
      const scoreboard = await withRetry(() => this.espn.fetchScoreboard(), { logger: this.logger, context: "fetchScoreboard" });
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
      const skipCount = (this.skipCounts.get(gameId) ?? 0) + 1;
      this.skipCounts.set(gameId, skipCount);
      if (skipCount >= 3) {
        this.logger.warn({ gameId, consecutiveSkips: skipCount }, 'Game poll repeatedly skipped — previous poll still in flight');
      } else {
        this.logger.debug({ gameId }, 'Game poll skipped — already in flight');
      }
      return;
    }
    this.skipCounts.delete(gameId);
    this.inFlight.add(gameId);
    this.logger.debug({ gameId }, 'Polling game');

    try {
      const cachedGame = this.gameCache.get(gameId);
      if (!cachedGame) {
        this.logger.warn({ gameId }, 'No cached game found — skipping poll');
        return;
      }

      // Fetch summary and merge into cached game snapshot
      let game = cachedGame;
      try {
        const summary = await withRetry(() => this.espn.fetchGameSummary(gameId), { logger: this.logger, context: `fetchGameSummary(${gameId})` });
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
          this.logger.warn(
            { gameId, oldCursor: cachedGame.lastProcessedSeq, newCursor: maxSeq, reprocessedPlays: allPlays.length },
            'Play sequence regressed — resetting cursor and reprocessing all plays'
          );
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

    // Run play-level rules on any new plays (including the terminal poll for finished games)
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

    const newAlerts = allAlerts.length > 0
      ? await this.store.filterNewAlerts(allAlerts)
      : [];

    this.logger.info(
      {
        gameId: game.id,
        total: allAlerts.length,
        new: newAlerts.length,
        rules: allAlerts.map((a) => a.rule),
      },
      'Alerts evaluated'
    );

    if (allAlerts.length === 0) {
      await this.store.saveGame(game);
      return;
    }

    // Send new alerts
    for (const alert of newAlerts) {
      const tweetText = formatTweet(alert, game);

      if (this.dryRun) {
        this.logger.info({ alertId: alert.id, tweetText }, '[DRY RUN] Would send alert');
      } else {
        let allSent = true;
        await Promise.allSettled(
          this.notifiers.map(async (notifier) => {
            try {
              await notifier.send(alert, tweetText);
            } catch (err) {
              allSent = false;
              this.logger.error({ err, alertId: alert.id }, 'Notifier error');
            }
          })
        );
        // Only mark fired if all notifiers succeeded — partial failures retry next poll
        if (allSent) {
          await this.store.markAlertFired(alert);
        } else {
          this.logger.warn({ alertId: alert.id }, 'Some notifiers failed — alert will retry next poll');
        }
      }
    }

    // Always save game snapshot (persists lastProcessedSeq)
    await this.store.saveGame(game);
  }

  private async maybePostDailySummary(): Promise<void> {
    const games = [...this.gameCache.values()];
    if (games.length === 0 || !games.every((g) => g.status === 'post')) return;

    // Derive the game-day date from the earliest start time in ET.
    // Games may complete after midnight ET, so we can't use "today".
    const gameDate = earliestEtDate(games);
    if (await this.store.hasAlertFired(`daily-summary:${gameDate}`)) return;

    try {
      await postDailySummary(gameDate, games, this.espn, this.notifiers, this.store, this.logger, this.dryRun);
    } catch (err) {
      this.logger.error({ err }, 'Failed to post daily summary');
    }
  }

  private async pingHealthcheck(): Promise<void> {
    if (!this.healthcheckUrl) return;
    try {
      await axios.get(this.healthcheckUrl, { timeout: 5000 });
      this.logger.debug('Healthcheck pinged');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Healthcheck ping failed: ${code} ${message}`);
    }
  }
}
