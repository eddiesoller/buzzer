import { Game, isLive, isFinished } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

export class UpsetRule implements AlertRule {
  readonly name = 'upset';

  evaluate(game: Game): Alert[] {
    const { homeTeam: home, awayTeam: away } = game;
    if (!home.seed || !away.seed || home.seed === away.seed) return [];

    const seedDiff = Math.abs(home.seed - away.seed);
    const higherSeed = home.seed > away.seed ? home : away;
    const lowerSeed = home.seed > away.seed ? away : home;
    const isUnderdogLeading = higherSeed.score > lowerSeed.score;
    if (!isUnderdogLeading) return [];

    const score = formatScore(game.awayTeam, game.homeTeam);
    const alerts: Alert[] = [];

    if (isLive(game) && game.period >= 2) {
      alerts.push({
        id: makeAlertId(`${this.name}-brewing`, game.id),
        rule: this.name,
        gameId: game.id,
        headline: `UPSET ALERT: #${higherSeed.seed} ${higherSeed.shortName} leads #${lowerSeed.seed} ${lowerSeed.shortName}!`,
        body: `${score} | ${game.clock} - 2nd Half | ${seedDiff}-seed difference`,
        priority: 'high',
        createdAt: new Date(),
      });
    }

    if (isFinished(game)) {
      alerts.push({
        id: makeAlertId(`${this.name}-confirmed`, game.id),
        rule: this.name,
        gameId: game.id,
        headline: `UPSET: #${higherSeed.seed} ${higherSeed.shortName} defeats #${lowerSeed.seed} ${lowerSeed.shortName}!`,
        body: `Final: ${score} | ${seedDiff}-seed difference`,
        priority: 'high',
        createdAt: new Date(),
      });
    }

    return alerts;
  }
}
