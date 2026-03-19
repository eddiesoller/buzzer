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
      let oppScoreAtPeak = 0;
      for (const p of game.plays) {
        const teamScore = isHome ? p.homeScore : p.awayScore;
        const oppScore  = isHome ? p.awayScore : p.homeScore;
        const deficit = oppScore - teamScore;
        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          oppScoreAtPeak = oppScore;
        }
      }
      const teamNow = isHome ? game.homeTeam.score : game.awayTeam.score;
      const oppNow  = isHome ? game.awayTeam.score : game.homeTeam.score;
      // Sanity check: opponent's score at peak deficit must not exceed their current
      // score (scores only go up). If violated, plays data is inconsistent with
      // the scoreboard and the deficit reading is unreliable.
      if (maxDeficit >= COMEBACK_DEFICIT && teamNow > oppNow && oppScoreAtPeak <= oppNow) {
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
