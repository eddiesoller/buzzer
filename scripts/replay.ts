/**
 * Replays all NCAA Tournament games from a past season and prints alerts
 * that would have fired for snapshot-based rules.
 *
 * Snapshot-based rules that require live context (close-game, upset-brewing)
 * are skipped. Scoring-run and comeback use play-by-play and run against
 * finished games. verify-replay.ts provides ground-truth cross-checks for all
 * rules that run here.
 *
 * Usage:
 *   npx tsx scripts/replay.ts          # defaults to 2025 tournament
 *   npx tsx scripts/replay.ts 2024
 */
import { EspnClient } from '../src/espn/client.js';
import { parseScoreboard } from '../src/espn/scoreboard-parser.js';
import { mergeSummaryIntoGame } from '../src/espn/summary-parser.js';
import { GameFinalRule } from '../src/rules/game-final.js';
import { ScoringMilestoneRule } from '../src/rules/scoring-milestone.js';
import { OvertimeRule } from '../src/rules/overtime.js';
import { MultiDoubleRule } from '../src/rules/multi-double.js';
import { FiveByFiveRule } from '../src/rules/five-by-five.js';
import { GooseEggRule } from '../src/rules/goose-egg.js';
import { ScoringRunRule } from '../src/rules/scoring-run.js';
import { ComebackRule } from '../src/rules/comeback.js';
import { BigShotRule } from '../src/rules/big-shot.js';
import { AlertRule } from '../src/rules/rule.js';
import { formatTweet } from '../src/formatters/tweet.js';
import { Game } from '../src/types/game.js';
import { Alert } from '../src/types/alert.js';
import { TOURNAMENT_DATES, formatDate } from './utils.js';

const SNAPSHOT_RULES: AlertRule[] = [
  new GameFinalRule(),
  new OvertimeRule(),
  new ScoringMilestoneRule(),
  new ScoringRunRule(),
  new ComebackRule(),
  new MultiDoubleRule(),
  new FiveByFiveRule(),
  new GooseEggRule(),
];

const bigShotRule = new BigShotRule();
const SKIPPED_RULES = ['close-game', 'upset-brewing'];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function replay(year: string) {
  const dates = TOURNAMENT_DATES[year];
  if (!dates) {
    console.error(`No dates configured for year ${year}. Available: ${Object.keys(TOURNAMENT_DATES).join(', ')}`);
    process.exit(1);
  }

  const client = new EspnClient();
  const allAlerts: Array<{ date: string; game: string; alert: Alert }> = [];
  const firedIds = new Set<string>();

  console.log(`\n=== ${year} NCAA Tournament Replay ===`);
  console.log(`Skipping delta-based rules: ${SKIPPED_RULES.join(', ')}\n`);

  for (const date of dates) {
    const displayDate = formatDate(date);
    console.log(`--- ${displayDate} ---`);

    let scoreboard;
    try {
      scoreboard = await client.fetchScoreboard(date);
    } catch (err) {
      console.error(`  Failed to fetch scoreboard: ${err}`);
      await sleep(1000);
      continue;
    }

    const games = parseScoreboard(scoreboard);
    const finished = games.filter((g) => g.status === 'post');
    console.log(`  ${finished.length} completed games`);

    for (const game of finished) {
      // Fetch box score for player-stat rules
      let enriched: Game = game;
      try {
        const summary = await client.fetchGameSummary(game.id);
        enriched = mergeSummaryIntoGame(game, summary);
        await sleep(200); // be polite to ESPN's servers
      } catch {
        // proceed with scoreboard-only data
      }

      const gameLabel = `${enriched.awayTeam.abbreviation} @ ${enriched.homeTeam.abbreviation}`;
      const scoreLabel = `(${enriched.awayTeam.score}-${enriched.homeTeam.score})`;
      const gameAlerts: Alert[] = [];

      for (const rule of SNAPSHOT_RULES) {
        try {
          const alerts = rule.evaluate(enriched);
          for (const alert of alerts) {
            if (!firedIds.has(alert.id)) {
              firedIds.add(alert.id);
              gameAlerts.push(alert);
            }
          }
        } catch (err) {
          console.error(`  [${rule.name}] Error: ${err}`);
        }
      }

      // Play-level rules
      for (const play of enriched.plays ?? []) {
        try {
          const alert = bigShotRule.evaluate(play, enriched);
          if (alert && !firedIds.has(alert.id)) {
            firedIds.add(alert.id);
            gameAlerts.push(alert);
          }
        } catch (err) {
          console.error(`  [big-shot] Error: ${err}`);
        }
      }

      if (gameAlerts.length > 0) {
        console.log(`\n  ${gameLabel} ${scoreLabel}`);
        for (const alert of gameAlerts) {
          allAlerts.push({ date: displayDate, game: gameLabel, alert });
          console.log(`    [${alert.priority.toUpperCase()}] ${alert.headline}`);
          console.log(`    Tweet: ${formatTweet(alert, enriched)}`);
          console.log();
        }
      }
    }

    await sleep(500);
  }

  // Summary
  const byRule = new Map<string, number>();
  for (const { alert } of allAlerts) {
    byRule.set(alert.rule, (byRule.get(alert.rule) ?? 0) + 1);
  }

  console.log('\n=== Summary ===');
  console.log(`Total alerts: ${allAlerts.length}`);
  for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${count}`);
  }
}

const year = process.argv[2] ?? '2025';
replay(year).catch(console.error);
