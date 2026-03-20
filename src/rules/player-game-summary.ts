import { Game, isFinished, getPlayerTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, ACHIEVED_THRESHOLD, countAtOrAbove, playerCardContext, formatScore } from './rule.js';

const SCORING_MIN = 30;
const FBF_THRESHOLD = 5;
const RULE_NAME = 'player-game-summary';

const CAT_LABELS = ['pts', 'reb', 'ast', 'stl', 'blk'] as const;

export class PlayerGameSummaryRule implements AlertRule {
  readonly name = RULE_NAME;

  evaluate(game: Game): Alert[] {
    if (!isFinished(game)) return [];
    if (!game.players?.length) return [];

    const alerts: Alert[] = [];

    for (const player of game.players) {
      const { points: pts, rebounds: reb, assists: ast, steals: stl, blocks: blk } = player;
      const cats = [pts, reb, ast, stl, blk];

      const isFiveByFive = countAtOrAbove(cats, FBF_THRESHOLD) === 5;
      const multiDoubleCount = countAtOrAbove(cats, ACHIEVED_THRESHOLD);
      const isScoring = pts >= SCORING_MIN;

      if (!isFiveByFive && multiDoubleCount < 2 && !isScoring) continue;

      const team = getPlayerTeam(game, player);

      let headline: string;
      let priority: 'high' | 'medium';

      if (isFiveByFive) {
        const statStr = cats.map((v, i) => `${v}${CAT_LABELS[i]}`).join('/');
        headline = `5x5 final line: ${player.playerName} (${statStr})`;
        priority = 'high';
      } else if (multiDoubleCount >= 3) {
        const label = multiDoubleCount >= 4 ? 'Quadruple-Double' : 'Triple-Double';
        const statStr = cats
          .map((v, i) => ({ value: v, label: CAT_LABELS[i]! }))
          .filter((s) => s.value >= ACHIEVED_THRESHOLD)
          .map((s) => `${s.value}${s.label}`)
          .join('/');
        headline = `${label} final line: ${player.playerName} (${statStr})`;
        priority = 'high';
      } else if (multiDoubleCount === 2) {
        const statStr = cats
          .map((v, i) => ({ value: v, label: CAT_LABELS[i]! }))
          .filter((s) => s.value >= ACHIEVED_THRESHOLD)
          .map((s) => `${s.value}${s.label}`)
          .join('/');
        headline = `Double-Double final line: ${player.playerName} (${statStr})`;
        priority = pts >= 40 ? 'high' : 'medium';
      } else {
        headline = `${player.playerName} finishes with ${pts} points (${pts}pts, ${reb}reb, ${ast}ast)`;
        priority = pts >= 40 ? 'high' : 'medium';
      }

      let cardStatLine = `${pts} PTS  ${reb} REB  ${ast} AST`;
      if (stl >= FBF_THRESHOLD) cardStatLine += `  ${stl} STL`;
      if (blk >= FBF_THRESHOLD) cardStatLine += `  ${blk} BLK`;

      const fg2Made = player.fieldGoalsMade - player.threePointMade;
      const fg2Att = player.fieldGoalsAttempted - player.threePointAttempted;
      const body = `Final | ${formatScore(game.awayTeam, game.homeTeam)} | 2FG: ${fg2Made}/${fg2Att} | 3FG: ${player.threePointMade}/${player.threePointAttempted} | FT: ${player.freeThrowsMade}/${player.freeThrowsAttempted}`;

      alerts.push({
        id: makeAlertId(RULE_NAME, game.id, player.playerId),
        rule: RULE_NAME,
        gameId: game.id,
        headline,
        body,
        priority,
        createdAt: new Date(),
        context: playerCardContext(player, team, cardStatLine, game, priority),
      });
    }

    return alerts;
  }
}
