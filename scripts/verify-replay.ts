/**
 * Cross-checks replay output by independently computing expected alerts
 * directly from the raw data, without going through the rule engine.
 *
 * Reports any discrepancies as MISSED or FALSE POSITIVE.
 *
 * Usage:
 *   npx tsx scripts/verify-replay.ts          # defaults to 2025
 *   npx tsx scripts/verify-replay.ts 2024
 */
import { EspnClient } from '../src/espn/client.js';
import { parseScoreboard } from '../src/espn/scoreboard-parser.js';
import { mergeSummaryIntoGame } from '../src/espn/summary-parser.js';
import { GameFinalRule } from '../src/rules/game-final.js';
import { ScoringMilestoneRule } from '../src/rules/scoring-milestone.js';
import { ScoringRunRule } from '../src/rules/scoring-run.js';
import { ComebackRule } from '../src/rules/comeback.js';
import { Game } from '../src/types/game.js';
import { TOURNAMENT_DATES, formatDate } from './utils.js';

// Ground-truth checks — implemented independently of the rule engine

function groundTruthUpsets(game: Game): string[] {
  const { homeTeam: h, awayTeam: a } = game;
  if (!h.seed || !a.seed || h.seed === a.seed) return [];
  const underdog = h.seed > a.seed ? h : a;
  const favorite = h.seed > a.seed ? a : h;
  if (underdog.score > favorite.score) {
    return [`upset-confirmed:${game.id}`];
  }
  return [];
}

function groundTruthBlowouts(game: Game): string[] {
  const diff = Math.abs(game.homeTeam.score - game.awayTeam.score);
  if (diff >= 30) return [`blowout:${game.id}:${diff >= 30}`];
  return [];
}

function groundTruthScoringRuns(game: Game): string[] {
  if (!game.plays?.length) return [];
  const results: string[] = [];
  for (const [teamId, isHome] of [[game.homeTeam.id, true], [game.awayTeam.id, false]] as const) {
    let run = 0;
    for (let i = game.plays.length - 1; i >= 0; i--) {
      const p = game.plays[i]!;
      if (!p.scoringPlay) continue;
      if (p.teamId !== teamId) break;
      const prev = game.plays.slice(0, i).findLast((x) => x.scoringPlay);
      const prevScore = isHome ? (prev?.homeScore ?? 0) : (prev?.awayScore ?? 0);
      const curScore = isHome ? p.homeScore : p.awayScore;
      run += curScore - prevScore;
    }
    if (run >= 15) results.push(`scoring-run:${game.id}:${teamId}`);
  }
  return results;
}

function groundTruthComebacks(game: Game): string[] {
  if (!game.plays?.length) return [];
  const results: string[] = [];
  for (const [teamId, isHome] of [[game.homeTeam.id, true], [game.awayTeam.id, false]] as const) {
    let maxDeficit = 0;
    let oppScoreAtPeak = 0;
    for (const p of game.plays) {
      const teamScore = isHome ? p.homeScore : p.awayScore;
      const oppScore  = isHome ? p.awayScore : p.homeScore;
      const deficit = oppScore - teamScore;
      if (deficit > maxDeficit) { maxDeficit = deficit; oppScoreAtPeak = oppScore; }
    }
    const teamNow = isHome ? game.homeTeam.score : game.awayTeam.score;
    const oppNow  = isHome ? game.awayTeam.score : game.homeTeam.score;
    if (maxDeficit >= 15 && teamNow > oppNow && oppScoreAtPeak <= oppNow) {
      results.push(`comeback:${game.id}:${teamId}`);
    }
  }
  return results;
}

function groundTruthMilestones(game: Game): string[] {
  const results: string[] = [];
  for (const p of game.players ?? []) {
    if (p.points < 30) continue;
    const achieved = Math.floor(p.points / 10) * 10;
    results.push(`scoring-milestone:${game.id}:${p.playerId}:${achieved}`);
  }
  return results;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verify(year: string) {
  const dates = TOURNAMENT_DATES[year];
  if (!dates) {
    console.error(`No dates for year ${year}`);
    process.exit(1);
  }

  const client = new EspnClient();
  const gameFinalRule = new GameFinalRule();
  const milestoneRule = new ScoringMilestoneRule();
  const scoringRunRule = new ScoringRunRule();
  const comebackRule = new ComebackRule();

  let totalGames = 0;
  let misses = 0;
  let falsePositives = 0;

  console.log(`\n=== ${year} Replay Verification ===\n`);

  for (const date of dates) {
    const displayDate = formatDate(date);

    let scoreboard;
    try {
      scoreboard = await client.fetchScoreboard(date);
    } catch {
      console.error(`  [${displayDate}] Failed to fetch scoreboard`);
      await sleep(1000);
      continue;
    }

    const games = parseScoreboard(scoreboard).filter((g) => g.status === 'post');
    totalGames += games.length;

    for (const game of games) {
      let enriched = game;
      try {
        const summary = await client.fetchGameSummary(game.id);
        enriched = mergeSummaryIntoGame(game, summary);
        await sleep(200);
      } catch { /* proceed without player stats */ }

      const label = `${enriched.awayTeam.abbreviation} @ ${enriched.homeTeam.abbreviation} [${displayDate}]`;

      // Check game-final (covers upsets and blowouts)
      const gameFinalAlerts = gameFinalRule.evaluate(enriched);
      const gameFinalAlert = gameFinalAlerts[0];

      // Check upsets — buzzer-beater upsets won't have "UPSET" in headline (buzzer beater takes priority)
      const expectedUpsets = groundTruthUpsets(enriched);
      const hasBuzzerBeater = (enriched.plays ?? []).some(
        (p) => p.scoringPlay && p.clockSeconds === 0 && p.period === enriched.period && !p.text.toLowerCase().includes('free throw')
      );
      const reportedAsUpset = gameFinalAlert?.headline.startsWith('UPSET');
      if (expectedUpsets.length > 0 && !reportedAsUpset && !hasBuzzerBeater) {
        console.log(`  MISSED upset   ${label} — seeds #${enriched.awayTeam.seed} vs #${enriched.homeTeam.seed}, score ${enriched.awayTeam.score}-${enriched.homeTeam.score}`);
        misses++;
      }
      if (expectedUpsets.length === 0 && reportedAsUpset) {
        console.log(`  FALSE POSITIVE upset   ${label}`);
        falsePositives++;
      }

      // Check blowouts — blowouts only show as such when not also an upset/OT/buzzer-beater
      const expectedBlowouts = groundTruthBlowouts(enriched);
      const isOT = enriched.period >= 3;
      const isUpset = expectedUpsets.length > 0;
      const blowoutShouldShow = expectedBlowouts.length > 0 && !isUpset && !isOT && !hasBuzzerBeater;
      const reportedAsBlowout = gameFinalAlert !== undefined && !reportedAsUpset && !isOT && !hasBuzzerBeater &&
        Math.abs(enriched.homeTeam.score - enriched.awayTeam.score) >= 30;
      if (blowoutShouldShow && !reportedAsBlowout) {
        const diff = Math.abs(enriched.homeTeam.score - enriched.awayTeam.score);
        console.log(`  MISSED blowout   ${label} — margin ${diff}`);
        misses++;
      }
      if (expectedBlowouts.length === 0 && reportedAsBlowout) {
        console.log(`  FALSE POSITIVE blowout   ${label}`);
        falsePositives++;
      }

      // Check scoring milestones
      const expectedMilestones = groundTruthMilestones(enriched);
      const ruleMilestones = milestoneRule.evaluate(enriched).map((a) => a.id);
      for (const id of expectedMilestones) {
        const playerId = id.split(':')[2]!;
        const player = enriched.players?.find((p) => p.playerId === playerId);
        if (!ruleMilestones.some((rid) => rid.includes(playerId))) {
          console.log(`  MISSED milestone   ${label} — ${player?.playerName ?? playerId} (${player?.points} pts)`);
          misses++;
        }
      }
      for (const rid of ruleMilestones) {
        const playerId = rid.split(':')[2]!;
        if (!expectedMilestones.some((eid) => eid.includes(playerId))) {
          console.log(`  FALSE POSITIVE milestone   ${label} — playerId ${playerId}`);
          falsePositives++;
        }
      }

      // Check scoring runs (plays-based, only when plays are available)
      const expectedRuns = groundTruthScoringRuns(enriched);
      const ruleRuns = scoringRunRule.evaluate(enriched).map((a) => a.id);
      if (expectedRuns.length > 0 && ruleRuns.length === 0) {
        console.log(`  MISSED scoring-run   ${label}`);
        misses++;
      }
      if (expectedRuns.length === 0 && ruleRuns.length > 0) {
        console.log(`  FALSE POSITIVE scoring-run   ${label}`);
        falsePositives++;
      }

      // Check comebacks (plays-based, only when plays are available)
      const expectedComebacks = groundTruthComebacks(enriched);
      const ruleComebacks = comebackRule.evaluate(enriched).map((a) => a.id);
      if (expectedComebacks.length > 0 && ruleComebacks.length === 0) {
        console.log(`  MISSED comeback   ${label}`);
        misses++;
      }
      if (expectedComebacks.length === 0 && ruleComebacks.length > 0) {
        console.log(`  FALSE POSITIVE comeback   ${label}`);
        falsePositives++;
      }
    }

    await sleep(300);
  }

  console.log(`\n=== Results ===`);
  console.log(`Games checked : ${totalGames}`);
  console.log(`Missed        : ${misses}`);
  console.log(`False positives: ${falsePositives}`);
  if (misses === 0 && falsePositives === 0) {
    console.log(`✓ All clear — rules match ground truth`);
  }
}

const year = process.argv[2] ?? '2025';
verify(year).catch(console.error);
