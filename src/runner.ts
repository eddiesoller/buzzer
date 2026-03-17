import axios from 'axios';
import { Logger } from 'pino';
import { EspnClient } from './espn/client.js';
import { parseScoreboard } from './espn/scoreboard-parser.js';
import { mergeSummaryIntoGame } from './espn/summary-parser.js';
import { StateStore } from './state/store.js';
import { AlertRule } from './rules/rule.js';
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
import { Notifier } from './notifiers/notifier.js';
import { formatTweet } from './formatters/tweet.js';
import { Game, isLive, isFinished } from './types/game.js';
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

export class Runner {
  private espn: EspnClient;
  /** In-memory cache of finished game IDs whose plays are already in the store */
  private readonly finishedWithPlays = new Set<string>();

  constructor(
    private readonly store: StateStore,
    private readonly notifiers: Notifier[],
    private readonly logger: Logger,
    private readonly dryRun: boolean,
    private readonly healthcheckUrl?: string,
  ) {
    this.espn = new EspnClient();
  }

  async poll(): Promise<void> {
    this.logger.info('Polling ESPN scoreboard...');

    let scoreboard;
    try {
      scoreboard = await withRetry(() => this.espn.fetchScoreboard());
    } catch (err) {
      this.logger.error({ err }, 'Failed to fetch scoreboard');
      return;
    }

    const games = parseScoreboard(scoreboard);
    this.logger.debug({ count: games.length }, 'Parsed games');

    const activeGames = games.filter((g) => isLive(g) || isFinished(g));
    if (activeGames.length === 0) {
      this.logger.info('No active games');
      await this.pingHealthcheck();
      return;
    }

    this.logger.info({ count: activeGames.length }, 'Active games found');

    // Fetch box scores for all active games (live and finished)
    // Finished games need plays for comeback/scoring-run detection in case
    // the game ended between polls
    const gamesWithStats = await this.fetchBoxScores(activeGames);

    // Process each game
    for (const game of gamesWithStats) {
      await this.processGame(game);
    }

    await this.pingHealthcheck();
  }

  private async fetchBoxScores(games: Game[]): Promise<Game[]> {
    const enrichedMap = new Map<string, Game>(games.map((g) => [g.id, g]));

    await Promise.allSettled(
      games.map(async (game) => {
        try {
          if (isFinished(game)) {
            // Finished game data never changes — avoid re-fetching across polls
            // and across restarts by checking the store first.
            if (this.finishedWithPlays.has(game.id)) return;
            const saved = await this.store.loadGame(game.id);
            if (saved?.plays) {
              enrichedMap.set(game.id, { ...game, plays: saved.plays, players: saved.players });
              this.finishedWithPlays.add(game.id);
              return;
            }
          }

          const summary = await withRetry(() => this.espn.fetchGameSummary(game.id));
          const enriched = mergeSummaryIntoGame(game, summary);
          enrichedMap.set(game.id, enriched);
          if (isFinished(game)) this.finishedWithPlays.add(game.id);
        } catch (err) {
          this.logger.warn({ err, gameId: game.id }, 'Failed to fetch game summary');
        }
      })
    );

    return games.map((g) => enrichedMap.get(g.id) ?? g);
  }

  private async processGame(game: Game): Promise<void> {
    const allAlerts: Alert[] = [];

    // Run scoreboard rules
    for (const rule of SCOREBOARD_RULES) {
      try {
        const alerts = rule.evaluate(game);
        allAlerts.push(...alerts);
      } catch (err) {
        this.logger.warn({ err, rule: rule.name, gameId: game.id }, 'Rule evaluation error');
      }
    }

    // Run box score rules (only if player data is available)
    if (game.players && game.players.length > 0) {
      for (const rule of BOX_SCORE_RULES) {
        try {
          const alerts = rule.evaluate(game);
          allAlerts.push(...alerts);
        } catch (err) {
          this.logger.warn({ err, rule: rule.name, gameId: game.id }, 'Rule evaluation error');
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
        await Promise.allSettled(
          this.notifiers.map(async (notifier) => {
            try {
              await notifier.send(alert, tweetText);
            } catch (err) {
              this.logger.error({ err, alertId: alert.id }, 'Notifier error');
            }
          })
        );
        await this.store.markAlertFired(alert);
      }
    }

    // Always save game snapshot
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
