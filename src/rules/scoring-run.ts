import { Game, Play, isLive, isFinished } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, gameCardContext, gamePeriodLabel } from './rule.js';

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
        id: makeAlertId(this.name, game.id, game.homeTeam.id, String(Math.floor(homeRun / 5) * 5)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.homeTeam.shortName} on a ${homeRun}-0 scoring run!`,
        body: `${score} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock}`,
        priority: 'medium',
        createdAt: new Date(),
        context: gameCardContext(game, 'SCORING RUN', 'medium'),
      });
    }

    if (awayRun >= RUN_THRESHOLD) {
      alerts.push({
        id: makeAlertId(this.name, game.id, game.awayTeam.id, String(Math.floor(awayRun / 5) * 5)),
        rule: this.name,
        gameId: game.id,
        headline: `${game.awayTeam.shortName} on a ${awayRun}-0 scoring run!`,
        body: `${score} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock}`,
        priority: 'medium',
        createdAt: new Date(),
        context: gameCardContext(game, 'SCORING RUN', 'medium'),
      });
    }

    return alerts;
  }

  private activeRun(plays: Play[], teamId: string, isHome: boolean): number {
    // Forward pass: record the index of the previous scoring play at each position
    let lastScoringIdx = -1;
    const prevScoringIdx: number[] = new Array(plays.length).fill(-1);
    for (let i = 0; i < plays.length; i++) {
      prevScoringIdx[i] = lastScoringIdx;
      if (plays[i]!.scoringPlay) lastScoringIdx = i;
    }

    // Backward pass: accumulate run until opponent scores
    let run = 0;
    for (let i = plays.length - 1; i >= 0; i--) {
      const p = plays[i]!;
      if (!p.scoringPlay) continue;
      if (p.teamId !== teamId) break; // opponent scored — run ended
      const prevIdx = prevScoringIdx[i];
      const prev = prevIdx >= 0 ? plays[prevIdx] : null;
      const prevScore = isHome ? (prev?.homeScore ?? 0) : (prev?.awayScore ?? 0);
      const curScore = isHome ? p.homeScore : p.awayScore;
      run += curScore - prevScore;
    }
    return run;
  }
}
