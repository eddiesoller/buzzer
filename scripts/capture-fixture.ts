/**
 * Captures live ESPN API responses as test fixtures.
 * Run during a live game: npx tsx scripts/capture-fixture.ts [gameId]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EspnClient } from '../src/espn/client.js';

const FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures');

async function capture(gameId?: string) {
  const client = new EspnClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  mkdirSync(FIXTURES_DIR, { recursive: true });

  // Capture scoreboard
  console.log('Fetching scoreboard...');
  const scoreboard = await client.fetchScoreboard();
  const scoreboardPath = join(FIXTURES_DIR, `scoreboard-${timestamp}.json`);
  writeFileSync(scoreboardPath, JSON.stringify(scoreboard, null, 2));
  console.log(`Saved scoreboard to ${scoreboardPath}`);

  // List live games
  const liveGames = scoreboard.events.filter(
    (e) => e.status.type.state === 'in'
  );
  console.log(`Live games: ${liveGames.length}`);
  liveGames.forEach((g) => console.log(`  ${g.id}: ${g.name}`));

  // Capture specific game summary
  if (gameId) {
    console.log(`\nFetching summary for game ${gameId}...`);
    const summary = await client.fetchGameSummary(gameId);
    const summaryPath = join(FIXTURES_DIR, `summary-${gameId}-${timestamp}.json`);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Saved summary to ${summaryPath}`);
  } else if (liveGames.length > 0) {
    const firstGame = liveGames[0]!;
    console.log(`\nFetching summary for first live game: ${firstGame.id}...`);
    const summary = await client.fetchGameSummary(firstGame.id);
    const summaryPath = join(FIXTURES_DIR, `summary-${firstGame.id}-${timestamp}.json`);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Saved summary to ${summaryPath}`);
  }
}

const gameId = process.argv[2];
capture(gameId).catch(console.error);
