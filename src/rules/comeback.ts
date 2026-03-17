import { Game, isLive, isFinished } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

const COMEBACK_DEFICIT = 15;

export class ComebackRule implements AlertRule {
  readonly name = 'comeback';

  evaluate(game: Game): Alert[] {
    if ((!isLive(game) && !isFinished(game)) || !game.plays?.length) return [];

    for (const [team] of [
      [game.homeTeam, game.awayTeam],
      [game.awayTeam, game.homeTeam],
    ] as const) {
      const isHome = team.id === game.homeTeam.id;
      let maxDeficit = 0;
      for (const p of game.plays) {
        const teamScore = isHome ? p.homeScore : p.awayScore;
        const oppScore  = isHome ? p.awayScore : p.homeScore;
        maxDeficit = Math.max(maxDeficit, oppScore - teamScore);
      }
      const teamNow = isHome ? game.homeTeam.score : game.awayTeam.score;
      const oppNow  = isHome ? game.awayTeam.score : game.homeTeam.score;
      if (maxDeficit >= COMEBACK_DEFICIT && teamNow > oppNow) {
        return [{
          id: makeAlertId(this.name, game.id, team.id),
          rule: this.name,
          gameId: game.id,
          headline: `Comeback! ${team.shortName} erases ${maxDeficit}-point deficit and takes the lead!`,
          body: `${formatScore(game.awayTeam, game.homeTeam)} | ${game.clock}`,
          priority: 'high',
          createdAt: new Date(),
        }];
      }
    }

    return [];
  }
}
