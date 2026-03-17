import { Game, isLive, isFinished, leadingTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

function otLabel(period: number): string {
  return period === 3 ? 'OT' : `${period - 2}OT`;
}

export class OvertimeRule implements AlertRule {
  readonly name = 'overtime';

  evaluate(game: Game): Alert[] {
    if (game.period < 3) return [];

    const score = formatScore(game.awayTeam, game.homeTeam);
    const label = otLabel(game.period);

    if (isFinished(game)) {
      const winner = leadingTeam(game);
      return [{
        id: makeAlertId(`${this.name}-final`, game.id),
        rule: this.name,
        gameId: game.id,
        headline: `${winner?.shortName ?? 'Game'} wins in ${label}!`,
        body: `Final: ${score}`,
        priority: 'high',
        createdAt: new Date(),
      }];
    }

    if (isLive(game)) {
      return [{
        id: makeAlertId(this.name, game.id, String(game.period)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} vs ${game.homeTeam.shortName} goes to ${label}!`,
        body: score,
        priority: 'high',
        createdAt: new Date(),
      }];
    }

    return [];
  }
}
