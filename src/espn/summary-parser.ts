import { EspnSummaryResponse, EspnPlayerStatEntry, EspnPlayerStatGroup } from '../types/espn.js';
import { Game, Play, PlayerStats } from '../types/game.js';

/**
 * Merges player stats from the summary endpoint into an existing Game object.
 */
export function mergeSummaryIntoGame(game: Game, summary: EspnSummaryResponse): Game {
  if (!summary.boxscore?.players) return game;

  const players: PlayerStats[] = [];

  for (const teamPlayers of summary.boxscore.players) {
    const teamId = teamPlayers.team.id;

    for (const statGroup of teamPlayers.statistics) {
      for (const athlete of statGroup.athletes) {
        if (athlete.didNotPlay) continue;

        const stats = parsePlayerStats(athlete, statGroup, teamId);
        if (stats) players.push(stats);
      }
    }
  }

  const plays: Play[] = (summary.plays ?? []).map((p) => ({
    teamId: p.team?.id ?? null,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    scoringPlay: p.scoringPlay,
    period: p.period.number,
    clockSeconds: parseDisplayClock(p.clock.displayValue),
  }));

  return { ...game, players, plays };
}

function parseDisplayClock(display: string): number {
  const parts = display.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  }
  return 0;
}

function parsePlayerStats(
  athlete: EspnPlayerStatEntry,
  group: EspnPlayerStatGroup,
  teamId: string
): PlayerStats | null {
  const keys = group.keys;
  const stats = athlete.stats;

  const get = (key: string): string => {
    const idx = keys.indexOf(key);
    return idx >= 0 ? (stats[idx] ?? '0') : '0';
  };

  const parseMinutes = (minStr: string): number => {
    // Format: "32:15" or "32"
    const parts = minStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0] ?? '0', 10) + parseInt(parts[1] ?? '0', 10) / 60;
    }
    return parseInt(minStr, 10) || 0;
  };

  const parseFraction = (frac: string): [number, number] => {
    // Format: "5-10"
    const parts = frac.split('-');
    return [parseInt(parts[0] ?? '0', 10) || 0, parseInt(parts[1] ?? '0', 10) || 0];
  };

  const [fgm, fga] = parseFraction(get('fieldGoalsMade-fieldGoalsAttempted'));
  const [tpm, tpa] = parseFraction(get('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
  const [ftm, fta] = parseFraction(get('freeThrowsMade-freeThrowsAttempted'));

  const minutes = parseMinutes(get('minutes'));
  const points = parseInt(get('points'), 10) || 0;
  const rebounds = parseInt(get('rebounds'), 10) || 0;
  const oreb = parseInt(get('offensiveRebounds'), 10) || 0;
  const dreb = parseInt(get('defensiveRebounds'), 10) || 0;
  const assists = parseInt(get('assists'), 10) || 0;
  const steals = parseInt(get('steals'), 10) || 0;
  const blocks = parseInt(get('blocks'), 10) || 0;
  const turnovers = parseInt(get('turnovers'), 10) || 0;
  const fouls = parseInt(get('fouls'), 10) || 0;
  const plusMinus = parseInt(get('plusMinus'), 10) || 0;

  return {
    playerId: athlete.athlete.id,
    playerName: athlete.athlete.displayName,
    teamId,
    minutesPlayed: minutes,
    points,
    rebounds,
    offensiveRebounds: oreb,
    defensiveRebounds: dreb,
    assists,
    steals,
    blocks,
    turnovers,
    fieldGoalsMade: fgm,
    fieldGoalsAttempted: fga,
    threePointMade: tpm,
    threePointAttempted: tpa,
    freeThrowsMade: ftm,
    freeThrowsAttempted: fta,
    fouls,
    plusMinus,
    starter: athlete.starter,
  };
}
