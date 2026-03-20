import { Game, isFinished, getPlayerTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, playerCardContext } from './rule.js';

const MIN_MINUTES = 20;

export class GooseEggRule implements AlertRule {
  readonly name = 'goose-egg';

  evaluate(game: Game): Alert[] {
    if (!game.players?.length || !isFinished(game)) return [];

    const alerts: Alert[] = [];

    for (const player of game.players) {
      if (player.minutesPlayed < MIN_MINUTES) continue;
      if (player.points > 0 || player.rebounds > 0 || player.assists > 0) continue;

      const team = getPlayerTeam(game, player);
      alerts.push({
        id: makeAlertId(this.name, game.id, player.playerId, game.period.toString()),
        rule: this.name,
        gameId: game.id,
        headline: `${player.playerName} (${team.abbreviation}) had 0 pts/reb/ast in ${Math.floor(player.minutesPlayed)} min`,
        body: `${formatScore(game.awayTeam, game.homeTeam)} | ${game.clock}`,
        priority: 'low',
        createdAt: new Date(),
        context: playerCardContext(player, team, '0 PTS  0 REB  0 AST', game, 'low'),
      });
    }

    return alerts;
  }
}
