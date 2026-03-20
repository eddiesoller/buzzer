import { Game } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, findMultiDoubleCandidates, playerCardContext } from './rule.js';

export class TripleDoubleRule implements AlertRule {
  readonly name = 'triple-double';

  evaluate(game: Game): Alert[] {
    return findMultiDoubleCandidates(game, 3).map(({ player, team, status, stats }) => {
      const statStr = stats.map((s) => `${s.value}${s.label}`).join('/');
      const cardStatLine = stats.map((s) => `${s.value} ${s.label.toUpperCase()}`).join('  ');
      if (status === 'achieved') {
        return {
          id: makeAlertId(this.name, game.id, player.playerId),
          rule: this.name,
          gameId: game.id,
          headline: `Triple-Double: ${player.playerName}! (${statStr})`,
          body: `${team.abbreviation} | ${game.clock}`,
          priority: 'high' as const,
          createdAt: new Date(),
          context: playerCardContext(player, team, cardStatLine, game, 'high'),
        };
      }
      return {
        id: makeAlertId(`${this.name}-approaching`, game.id, player.playerId),
        rule: this.name,
        gameId: game.id,
        headline: `${player.playerName} approaching triple-double (${statStr})`,
        body: `${team.abbreviation} | ${game.clock} remaining`,
        priority: 'medium' as const,
        createdAt: new Date(),
        context: playerCardContext(player, team, cardStatLine, game, 'medium'),
      };
    });
  }
}
