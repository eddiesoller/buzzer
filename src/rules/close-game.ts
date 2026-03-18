import { Game, margin, estimateSecondsRemaining, isLive, isFinished, leadingTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

const CLOSE_GAME_MARGIN = 5;
const CLOSE_GAME_SECONDS_REMAINING = 5 * 60;

export class CloseGameRule implements AlertRule {
  readonly name = 'close-game';

  evaluate(game: Game): Alert[] {
    const diff = margin(game);

    // Close final — regulation only (OT games are covered by OvertimeRule)
    if (isFinished(game) && game.period === 2 && diff <= CLOSE_GAME_MARGIN) {
      const winner = leadingTeam(game);
      const score = formatScore(game.awayTeam, game.homeTeam);
      return [{
        id: makeAlertId(`${this.name}-final`, game.id),
        rule: this.name,
        gameId: game.id,
        headline: `${winner?.shortName ?? 'Close'} wins a thriller! Final: ${score}`,
        body: `${game.awayTeam.name} vs ${game.homeTeam.name}`,
        priority: 'high',
        createdAt: new Date(),
      }];
    }

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

    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline,
      body: `${game.awayTeam.name} vs ${game.homeTeam.name} | ${game.clock} - 2nd Half`,
      priority: diff === 0 ? 'high' : 'medium',
      createdAt: new Date(),
    }];
  }
}
