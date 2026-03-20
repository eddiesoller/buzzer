export interface Team {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  seed?: number;
  score: number;
  record?: string;
  logo?: string;
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  minutesPlayed: number;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointMade: number;
  threePointAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  fouls: number;
  plusMinus: number;
  starter: boolean;
}

export interface Play {
  teamId: string | null;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
  period: number;
  clockSeconds: number;
  clockDisplay: string;
  sequenceNumber: number;
  text: string;
  coordinate?: { x: number; y: number };
}

export type GameStatus = 'pre' | 'in' | 'post';

export interface Game {
  id: string;
  status: GameStatus;
  period: number;
  /** Display clock string e.g. "5:23" */
  clock: string;
  /** Seconds remaining in current period */
  clockSeconds: number;
  homeTeam: Team;
  awayTeam: Team;
  /** Player stats — absent if summary fetch failed */
  players?: PlayerStats[];
  /** Play-by-play — absent if summary fetch failed */
  plays?: Play[];
  /** Sequence number of last processed play — used to avoid re-processing plays across polls */
  lastProcessedSeq?: number;
  /** Win probability for home team (0–1), from ESPN scoreboard. Absent if not provided. */
  homeWinPct?: number;
  /** Win probability for away team (0–1), from ESPN scoreboard. Absent if not provided. */
  awayWinPct?: number;
  /** True when ESPN reports STATUS_HALFTIME */
  halftime?: boolean;
  startTime: string;
  venue?: string;
}

/** Returns estimated total game seconds remaining */
export function estimateSecondsRemaining(game: Game): number {
  const HALF_SECONDS = 20 * 60; // 20 min halves

  if (game.status === 'pre') return HALF_SECONDS * 2;
  if (game.status === 'post') return 0;

  if (game.period === 1) {
    return game.clockSeconds + HALF_SECONDS;
  } else if (game.period === 2) {
    return game.clockSeconds;
  } else {
    // Overtime periods (3+)
    return game.clockSeconds;
  }
}

export function isLive(game: Game): boolean {
  return game.status === 'in';
}

export function isFinished(game: Game): boolean {
  return game.status === 'post';
}

export function margin(game: Game): number {
  return Math.abs(game.homeTeam.score - game.awayTeam.score);
}

export function leadingTeam(game: Game): Team | null {
  if (game.homeTeam.score > game.awayTeam.score) return game.homeTeam;
  if (game.awayTeam.score > game.homeTeam.score) return game.awayTeam;
  return null;
}

export function trailingTeam(game: Game): Team | null {
  if (game.homeTeam.score < game.awayTeam.score) return game.homeTeam;
  if (game.awayTeam.score < game.homeTeam.score) return game.awayTeam;
  return null;
}

export function getPlayerTeam(game: Game, player: PlayerStats): Team {
  return game.homeTeam.id === player.teamId ? game.homeTeam : game.awayTeam;
}
