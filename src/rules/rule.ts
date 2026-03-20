import { Game, PlayerStats, Team, estimateSecondsRemaining, getPlayerTeam } from '../types/game.js';
import { Alert, AlertPriority } from '../types/alert.js';
import { GameCardContext, PlayerCardContext } from '../types/score-card.js';

export interface AlertRule {
  readonly name: string;
  evaluate(game: Game): Alert[];
}

export function makeAlertId(rule: string, gameId: string, ...specifics: string[]): string {
  return [rule, gameId, ...specifics].join(':');
}

/** Shared time gate for "approaching" stat alerts */
export const TIME_GATE_SECONDS = 3 * 60;

/** Thresholds for triple/quadruple-double approaching and achieved */
export const APPROACHING_THRESHOLD = 8;
export const ACHIEVED_THRESHOLD = 10;

/** Counts how many values meet or exceed threshold */
export function countAtOrAbove(values: number[], threshold: number): number {
  return values.filter((v) => v >= threshold).length;
}

/** "OT" for period 3, "2OT" for period 4, etc. */
export function otLabel(period: number): string {
  return period === 3 ? 'OT' : `${period - 2}OT`;
}

/** "AWAY 75, HOME 72" */
export function formatScore(away: Team, home: Team): string {
  return `${away.abbreviation} ${away.score}, ${home.abbreviation} ${home.score}`;
}

/**
 * Returns a formatted win probability string for a team, e.g. "Duke 68% to win".
 * Returns null if probability is unavailable or outside the informative range (20–80%).
 */
export function formatWinPct(game: Game, team: Team): string | null {
  const pct = team.id === game.homeTeam.id ? game.homeWinPct : game.awayWinPct;
  if (pct === undefined) return null;
  const rounded = Math.round(pct * 100);
  if (rounded < 20 || rounded > 80) return null;
  return `${team.shortName} ${rounded}% to win`;
}

export function gameCardContext(game: Game, label: string, priority: AlertPriority): GameCardContext {
  return {
    kind: 'game',
    priority,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    period: game.period,
    clock: game.clock,
    status: game.status,
    label,
  };
}

export function playerCardContext(
  player: PlayerStats,
  team: Team,
  statLine: string,
  game: Game,
  priority: AlertPriority,
): PlayerCardContext {
  return {
    kind: 'player',
    priority,
    playerName: player.playerName,
    teamName: team.name,
    playerTeam: team,
    statLine,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    period: game.period,
    clock: game.clock,
    status: game.status,
  };
}

const STAT_KEYS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'points',   label: 'pts' },
  { key: 'rebounds', label: 'reb' },
  { key: 'assists',  label: 'ast' },
  { key: 'steals',   label: 'stl' },
  { key: 'blocks',   label: 'blk' },
];

export interface MultiDoubleCandidate {
  player: PlayerStats;
  team: Team;
  status: 'achieved' | 'approaching';
  /** Only the stat categories that meet the relevant threshold */
  stats: Array<{ label: string; value: number }>;
}

/** Returns players who have achieved or are approaching a multi-double */
export function findMultiDoubleCandidates(game: Game, required: number): MultiDoubleCandidate[] {
  if (!game.players?.length) return [];

  const remaining = estimateSecondsRemaining(game);
  const candidates: MultiDoubleCandidate[] = [];

  for (const player of game.players) {
    const allStats = STAT_KEYS.map(({ key, label }) => ({ label, value: player[key] as number }));
    const team = getPlayerTeam(game, player);

    const achievedStats = allStats.filter((s) => s.value >= ACHIEVED_THRESHOLD);
    if (achievedStats.length >= required) {
      candidates.push({ player, team, status: 'achieved', stats: achievedStats });
      continue;
    }

    if (remaining > 0 && remaining <= TIME_GATE_SECONDS) {
      const approachingStats = allStats.filter((s) => s.value >= APPROACHING_THRESHOLD);
      if (approachingStats.length >= required) {
        candidates.push({ player, team, status: 'approaching', stats: approachingStats });
      }
    }
  }

  return candidates;
}
