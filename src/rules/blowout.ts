import { Game, margin, leadingTeam, isFinished } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

const BLOWOUT_MARGIN = 30;

export class BlowoutRule implements AlertRule {
  readonly name = 'blowout';

  evaluate(game: Game): Alert[] {
    const diff = margin(game);
    if (diff < BLOWOUT_MARGIN) return [];

    const leader = leadingTeam(game);
    if (!leader) return [];

    const trailer = game.homeTeam === leader ? game.awayTeam : game.homeTeam;
    const score = formatScore(game.awayTeam, game.homeTeam);

    if (isFinished(game)) {
      return [{
        id: makeAlertId(`${this.name}-final`, game.id),
        rule: this.name,
        gameId: game.id,
        headline: `${leader.shortName} blew out ${trailer.shortName} by ${diff}`,
        body: `Final: ${score}`,
        priority: 'low',
        createdAt: new Date(),
      }];
    }

    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline: `${leader.shortName} is blowing out ${trailer.shortName} by ${diff}`,
      body: `${score} | ${game.clock}`,
      priority: 'low',
      createdAt: new Date(),
    }];
  }
}
