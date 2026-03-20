import { Game, margin, estimateSecondsRemaining, isLive, leadingTeam } from '../types/game.js';
import { Alert, AlertPriority } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, formatWinPct } from './rule.js';

const CLOSE_GAME_MARGIN = 5;
const CLOSE_GAME_SECONDS_REMAINING = 5 * 60;

export class CloseGameRule implements AlertRule {
  readonly name = 'close-game';

  evaluate(game: Game): Alert[] {
    const diff = margin(game);

    // Close game alert — live, 2nd half, ≤5 min remaining
    if (!isLive(game) || game.period !== 2) return [];

    const remaining = estimateSecondsRemaining(game);
    if (remaining > CLOSE_GAME_SECONDS_REMAINING) return [];
    if (diff > CLOSE_GAME_MARGIN) return [];

    const minutesLeft = Math.ceil(remaining / 60);
    const scoreStr = formatScore(game.awayTeam, game.homeTeam);
    const headline = diff === 0
      ? `TIED GAME with ${minutesLeft}m left — ${scoreStr}`
      : `Close game! ${minutesLeft}m left — ${scoreStr}`;

    const leader = leadingTeam(game);
    const leaderWinPct = leader !== null
      ? (leader.id === game.homeTeam.id ? game.homeWinPct : game.awayWinPct)
      : undefined;

    let priority: AlertPriority;
    if (diff === 0) {
      priority = 'high';
    } else if (leaderWinPct !== undefined) {
      priority = leaderWinPct > 0.65 ? 'medium' : 'high';
    } else {
      priority = 'medium';
    }

    const winPctStr = leader !== null ? formatWinPct(game, leader) : null;
    const body = winPctStr
      ? `${game.awayTeam.name} vs ${game.homeTeam.name} | ${game.clock} - 2nd Half | ${winPctStr}`
      : `${game.awayTeam.name} vs ${game.homeTeam.name} | ${game.clock} - 2nd Half`;

    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline,
      body,
      priority,
      createdAt: new Date(),
    }];
  }
}
