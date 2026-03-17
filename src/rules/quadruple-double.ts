import { Game } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, findMultiDoubleCandidates } from './rule.js';

export class QuadrupleDoubleRule implements AlertRule {
  readonly name = 'quadruple-double';

  evaluate(game: Game): Alert[] {
    return findMultiDoubleCandidates(game, 4).map(({ player, team, status, stats }) => {
      const statStr = stats.map((s) => `${s.value}${s.label}`).join('/');
      if (status === 'achieved') {
        return {
          id: makeAlertId(this.name, game.id, player.playerId),
          rule: this.name,
          gameId: game.id,
          headline: `Quadruple-Double: ${player.playerName}! (${statStr})`,
          body: `${team.abbreviation} | ${game.clock}`,
          priority: 'high' as const,
          createdAt: new Date(),
        };
      }
      return {
        id: makeAlertId(`${this.name}-approaching`, game.id, player.playerId),
        rule: this.name,
        gameId: game.id,
        headline: `${player.playerName} approaching quadruple-double (${statStr})`,
        body: `${team.abbreviation} | ${game.clock} remaining`,
        priority: 'medium' as const,
        createdAt: new Date(),
      };
    });
  }
}
