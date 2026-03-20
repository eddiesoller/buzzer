import { Game, estimateSecondsRemaining, getPlayerTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, TIME_GATE_SECONDS, countAtOrAbove, playerCardContext, formatScore, gamePeriodLabel } from './rule.js';

const THRESHOLD = 5;

/**
 * Fires when a player records 5+ in all five stat categories (pts/reb/ast/stl/blk).
 * Historically extremely rare in college basketball — expect 0-1 fires per full
 * tournament. Zero fires in a replay is normal.
 */
export class FiveByFiveRule implements AlertRule {
  readonly name = 'five-by-five';

  evaluate(game: Game): Alert[] {
    if (!game.players?.length) return [];

    const remaining = estimateSecondsRemaining(game);
    const alerts: Alert[] = [];

    for (const player of game.players) {
      const { points: pts, rebounds: reb, assists: ast, steals: stl, blocks: blk } = player;
      const cats = [pts, reb, ast, stl, blk];
      const team = getPlayerTeam(game, player);

      if (countAtOrAbove(cats, THRESHOLD) === 5) {
        const cardStatLine = `${pts} PTS  ${reb} REB  ${ast} AST  ${stl} STL  ${blk} BLK`;
        alerts.push({
          id: makeAlertId(this.name, game.id, player.playerId),
          rule: this.name,
          gameId: game.id,
          headline: `5x5: ${player.playerName}! (${pts}pts/${reb}reb/${ast}ast/${stl}stl/${blk}blk)`,
          body: `${formatScore(game.awayTeam, game.homeTeam)} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock}`,
          priority: 'high',
          createdAt: new Date(),
          context: playerCardContext(player, team, cardStatLine, game, 'high'),
        });
        continue;
      }

      if (remaining > 0 && remaining <= TIME_GATE_SECONDS) {
        let atFive = 0, nearFive = 0;
        for (const v of cats) {
          if (v >= THRESHOLD) atFive++;
          if (v >= THRESHOLD - 1) nearFive++;
        }
        if (atFive >= 4 && nearFive >= 5) {
          const cardStatLine = `${pts} PTS  ${reb} REB  ${ast} AST  ${stl} STL  ${blk} BLK`;
          alerts.push({
            id: makeAlertId(`${this.name}-approaching`, game.id, player.playerId),
            rule: this.name,
            gameId: game.id,
            headline: `${player.playerName} chasing a 5x5! (${pts}/${reb}/${ast}/${stl}/${blk})`,
            body: `${formatScore(game.awayTeam, game.homeTeam)} | pts/reb/ast/stl/blk | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock} remaining`,
            priority: 'medium',
            createdAt: new Date(),
            context: playerCardContext(player, team, cardStatLine, game, 'medium'),
          });
        }
      }
    }

    return alerts;
  }
}
