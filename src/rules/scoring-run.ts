import { Game, Play, isLive, isFinished } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

const RUN_THRESHOLD = 15;

export class ScoringRunRule implements AlertRule {
  readonly name = 'scoring-run';

  evaluate(game: Game): Alert[] {
    if ((!isLive(game) && !isFinished(game)) || !game.plays?.length) return [];

    const homeRun = this.activeRun(game.plays, game.homeTeam.id, true);
    const awayRun = this.activeRun(game.plays, game.awayTeam.id, false);

    const alerts: Alert[] = [];
    const score = formatScore(game.awayTeam, game.homeTeam);

    if (homeRun >= RUN_THRESHOLD) {
      alerts.push({
        id: makeAlertId(this.name, game.id, game.homeTeam.id, String(homeRun)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.homeTeam.shortName} on a ${homeRun}-0 scoring run!`,
        body: `${score} | ${game.clock}`,
        priority: 'medium',
        createdAt: new Date(),
      });
    }

    if (awayRun >= RUN_THRESHOLD) {
      alerts.push({
        id: makeAlertId(this.name, game.id, game.awayTeam.id, String(awayRun)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} on a ${awayRun}-0 scoring run!`,
        body: `${score} | ${game.clock}`,
        priority: 'medium',
        createdAt: new Date(),
      });
    }

    return alerts;
  }

  private activeRun(plays: Play[], teamId: string, isHome: boolean): number {
    let run = 0;
    for (let i = plays.length - 1; i >= 0; i--) {
      const p = plays[i]!;
      if (!p.scoringPlay) continue;
      if (p.teamId !== teamId) break; // opponent scored — run ended
      const prev = plays.slice(0, i).findLast((x) => x.scoringPlay);
      const prevScore = isHome ? (prev?.homeScore ?? 0) : (prev?.awayScore ?? 0);
      const curScore = isHome ? p.homeScore : p.awayScore;
      run += curScore - prevScore;
    }
    return run;
  }
}
