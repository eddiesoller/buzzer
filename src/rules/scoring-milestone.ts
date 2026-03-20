import { Game, getPlayerTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, playerCardContext, formatScore, gamePeriodLabel } from './rule.js';

const MIN_MILESTONE = 30;
const MILESTONE_STEP = 10;

function highestMilestone(points: number): number | undefined {
  if (points < MIN_MILESTONE) return undefined;
  return Math.floor(points / MILESTONE_STEP) * MILESTONE_STEP;
}

export class ScoringMilestoneRule implements AlertRule {
  readonly name = 'scoring-milestone';

  evaluate(game: Game): Alert[] {
    if (!game.players?.length) return [];

    const alerts: Alert[] = [];

    for (const player of game.players) {
      const achieved = highestMilestone(player.points);
      if (achieved === undefined) continue;

      const team = getPlayerTeam(game, player);
      const priority = achieved >= 40 ? 'high' as const : 'medium' as const;
      alerts.push({
        id: makeAlertId(this.name, game.id, player.playerId, String(achieved)),
        rule: this.name,
        gameId: game.id,
        headline: `${player.playerName} hits ${achieved}+ points! (${player.points} pts)`,
        body: `${formatScore(game.awayTeam, game.homeTeam)} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock} | FG: ${player.fieldGoalsMade}/${player.fieldGoalsAttempted}`,
        priority,
        createdAt: new Date(),
        context: playerCardContext(player, team, `${player.points} PTS`, game, priority),
      });
    }

    return alerts;
  }
}
