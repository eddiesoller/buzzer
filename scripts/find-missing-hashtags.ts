/**
 * One-off script: finds teams that appeared in the tournament but lack a hashtag override.
 * Usage: npx tsx scripts/find-missing-hashtags.ts [year]
 */
import { EspnClient } from '../src/espn/client.js';
import { parseScoreboard } from '../src/espn/scoreboard-parser.js';
import { TEAM_HASHTAGS } from '../src/formatters/team-hashtags.js';
import { TOURNAMENT_DATES, formatDate } from './utils.js';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const year = process.argv[2] ?? String(new Date().getFullYear());
  const dates = TOURNAMENT_DATES[year];
  if (!dates) {
    console.error(`No dates for year ${year}`);
    process.exit(1);
  }

  const client = new EspnClient();
  const seen = new Map<string, string>(); // abbrev -> displayName

  for (const date of dates) {
    try {
      const scoreboard = await client.fetchScoreboard(date);
      const games = parseScoreboard(scoreboard);
      for (const game of games) {
        seen.set(game.awayTeam.abbreviation, game.awayTeam.shortName);
        seen.set(game.homeTeam.abbreviation, game.homeTeam.shortName);
      }
      await sleep(300);
    } catch {
      // skip failed dates
    }
  }

  const missing = [...seen.entries()]
    .filter(([abbrev]) => !(abbrev in TEAM_HASHTAGS))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (missing.length === 0) {
    console.log('All teams have hashtag overrides.');
  } else {
    console.log(`Teams without a hashtag override (${missing.length}):\n`);
    for (const [abbrev, name] of missing) {
      console.log(`  ${abbrev.padEnd(8)} ${name}`);
    }
  }
}

run().catch(console.error);
