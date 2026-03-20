import { Logger } from 'pino';
import { EspnClient, EspnRateLimitError } from '../espn/client.js';
import { mergeSummaryIntoGame } from '../espn/summary-parser.js';
import { StateStore } from '../state/store.js';
import { Notifier } from '../notifiers/notifier.js';
import { SCOREBOARD_RULES, BOX_SCORE_RULES, PLAY_RULES } from '../rules/index.js';
import { getAlertPrefix } from '../formatters/tweet.js';
import { TEAM_HASHTAGS } from '../formatters/team-hashtags.js';
import { Game, Team } from '../types/game.js';
import { Alert } from '../types/alert.js';

const MAX_TWEET_LENGTH = 280;
const HASHTAG = process.env.BUZZER_HASHTAG ?? '#MarchMadness';
const SUMMARY_DELAY_MS = 2000;

const PRIORITY_ORDER: Record<Alert['priority'], number> = { high: 0, medium: 1, low: 2 };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function teamHashtag(team: Team): string {
  if (TEAM_HASHTAGS[team.abbreviation]) return TEAM_HASHTAGS[team.abbreviation];
  const derived = team.shortName.replace(/[^a-zA-Z0-9]/g, '');
  return `#${derived}`;
}

function evaluateRules(game: Game): Alert[] {
  const alerts: Alert[] = [];

  for (const rule of SCOREBOARD_RULES) {
    try { alerts.push(...rule.evaluate(game)); } catch (_) { /* swallow */ }
  }

  if (game.players && game.players.length > 0) {
    for (const rule of BOX_SCORE_RULES) {
      try { alerts.push(...rule.evaluate(game)); } catch (_) { /* swallow */ }
    }
  }

  for (const play of game.plays ?? []) {
    for (const rule of PLAY_RULES) {
      try {
        const alert = rule.evaluate(play, game);
        if (alert) alerts.push(alert);
      } catch (_) { /* swallow */ }
    }
  }

  return alerts;
}

function buildGameTweet(finalAlert: Alert, highlights: Alert[], game: Game): string {
  const awayTag = teamHashtag(game.awayTeam);
  const homeTag = teamHashtag(game.homeTeam);
  const tags = `${awayTag} ${homeTag} ${HASHTAG}`;

  const finalLine = `${getAlertPrefix(finalAlert)} ${finalAlert.headline}`;
  const highlightLines = highlights.map((h) => `${getAlertPrefix(h)} ${h.headline}`);

  // Try with all highlights, progressively drop from the end until it fits
  for (let numH = highlightLines.length; numH >= 0; numH--) {
    const lines = [finalLine, ...highlightLines.slice(0, numH)];
    const candidate = `${lines.join('\n')}\n${tags}`;
    if (candidate.length <= MAX_TWEET_LENGTH) {
      return candidate;
    }
  }

  // Truncate the final line itself
  const suffix = `…\n${tags}`;
  const maxLen = MAX_TWEET_LENGTH - suffix.length;
  return `${finalLine.slice(0, maxLen)}${suffix}`;
}

export function buildSummaryThread(
  date: string,
  gameAlerts: Map<string, Alert[]>,
  games: Game[],
): string[] {
  let upsetCount = 0;
  let otCount = 0;

  for (const game of games) {
    if (game.period >= 3) otCount++;
    const alerts = gameAlerts.get(game.id) ?? [];
    if (alerts.find((a) => a.rule === 'game-final' && a.headline.includes('UPSET'))) {
      upsetCount++;
    }
  }

  const totalGames = games.length;
  const parts: string[] = [`${totalGames} game${totalGames !== 1 ? 's' : ''}`];
  if (upsetCount > 0) parts.push(`${upsetCount} upset${upsetCount !== 1 ? 's' : ''}`);
  if (otCount > 0) parts.push(`${otCount} OT game${otCount !== 1 ? 's' : ''}`);

  const tweets: string[] = [`🏀 ${formatDateLabel(date)} Recap: ${parts.join(' | ')} ${HASHTAG}`];

  for (const game of games) {
    const alerts = gameAlerts.get(game.id) ?? [];
    const finalAlert = alerts.find((a) => a.rule === 'game-final');
    if (!finalAlert) continue;

    const highlights = alerts
      .filter((a) => a.rule !== 'game-final')
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, 3);

    tweets.push(buildGameTweet(finalAlert, highlights, game));
  }

  return tweets;
}

export async function postDailySummary(
  date: string,
  scoreboardGames: Game[],
  client: EspnClient,
  notifiers: Notifier[],
  store: StateStore,
  logger: Logger,
  dryRun: boolean,
): Promise<void> {
  logger.info({ date }, 'Building daily summary');

  if (scoreboardGames.length === 0) {
    logger.info({ date }, 'No games found for daily summary — skipping');
    return;
  }

  const gameAlerts = new Map<string, Alert[]>();
  const games: Game[] = [];

  for (const sbGame of scoreboardGames) {
    let game = sbGame;
    try {
      const summary = await client.fetchGameSummary(sbGame.id, SUMMARY_DELAY_MS);
      game = mergeSummaryIntoGame(sbGame, summary);
    } catch (err) {
      if (err instanceof EspnRateLimitError) {
        logger.warn({ gameId: sbGame.id, err: err.message }, 'Rate limited fetching game summary — skipping game');
        continue;
      }
      logger.warn({ err, gameId: sbGame.id }, 'Failed to fetch summary for daily summary — using scoreboard data only');
    }

    gameAlerts.set(game.id, evaluateRules(game));
    games.push(game);
  }

  if (games.length === 0) {
    logger.info({ date }, 'No game data available for daily summary — skipping');
    return;
  }

  const tweets = buildSummaryThread(date, gameAlerts, games);
  if (tweets.length === 0) {
    logger.info({ date }, 'No content for daily summary — skipping');
    return;
  }

  logger.info({ date, tweetCount: tweets.length }, 'Posting daily summary thread');

  if (dryRun) {
    for (let i = 0; i < tweets.length; i++) {
      logger.info(
        { tweetIndex: i + 1, total: tweets.length, tweetText: tweets[i] },
        '[DRY RUN] Daily summary tweet'
      );
    }
  } else {
    for (const notifier of notifiers) {
      try {
        if (notifier.sendThread) {
          await notifier.sendThread(tweets);
        } else {
          for (let i = 0; i < tweets.length; i++) {
            const fakeAlert: Alert = {
              id: `daily-summary:${date}:${i}`,
              rule: 'daily-summary',
              gameId: games[0]?.id ?? '',
              headline: tweets[i],
              body: '',
              priority: 'low',
              createdAt: new Date(),
            };
            await notifier.send(fakeAlert, tweets[i]);
          }
        }
      } catch (err) {
        logger.error({ err }, 'Notifier error sending daily summary thread');
      }
    }

    const firstGameId = games[0]?.id ?? 'unknown';
    await store.markAlertFired({
      id: `daily-summary:${date}`,
      rule: 'daily-summary',
      gameId: firstGameId,
      headline: `Daily summary for ${date}`,
      priority: 'low',
      createdAt: new Date(),
    });
  }

  logger.info({ date }, 'Daily summary complete');
}
