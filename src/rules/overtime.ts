import { Game, isLive } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, otLabel, gameCardContext } from './rule.js';

export class OvertimeRule implements AlertRule {
  readonly name = 'overtime';

  evaluate(game: Game): Alert[] {
    // End-of-period detection: fires immediately when regulation (or any OT period)
    // ends tied, before ESPN increments the period counter.
    if (isLive(game) && game.period >= 2 && game.clockSeconds === 0
        && game.homeTeam.score === game.awayTeam.score) {
      const nextPeriod = game.period + 1;
      const label = otLabel(nextPeriod);
      return [{
        id: makeAlertId(this.name, game.id, String(nextPeriod)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} vs ${game.homeTeam.shortName} goes to ${label}!`,
        body: formatScore(game.awayTeam, game.homeTeam),
        priority: 'high',
        createdAt: new Date(),
        context: gameCardContext(game, label, 'high'),
      }];
    }

    // Normal case: ESPN has already incremented to OT period.
    if (game.period >= 3 && isLive(game)) {
      const label = otLabel(game.period);
      return [{
        id: makeAlertId(this.name, game.id, String(game.period)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} vs ${game.homeTeam.shortName} goes to ${label}!`,
        body: formatScore(game.awayTeam, game.homeTeam),
        priority: 'high',
        createdAt: new Date(),
        context: gameCardContext(game, label, 'high'),
      }];
    }

    return [];
  }
}
