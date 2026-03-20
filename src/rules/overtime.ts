import { Game, isLive } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, otLabel, gameCardContext } from './rule.js';

export class OvertimeRule implements AlertRule {
  readonly name = 'overtime';

  evaluate(game: Game): Alert[] {
    if (game.period < 3) return [];

    const score = formatScore(game.awayTeam, game.homeTeam);
    const label = otLabel(game.period);

    if (isLive(game)) {
      return [{
        id: makeAlertId(this.name, game.id, String(game.period)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} vs ${game.homeTeam.shortName} goes to ${label}!`,
        body: score,
        priority: 'high',
        createdAt: new Date(),
        context: gameCardContext(game, label, 'high'),
      }];
    }

    return [];
  }
}
