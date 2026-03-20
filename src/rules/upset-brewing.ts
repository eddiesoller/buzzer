import { Game, isLive, estimateSecondsRemaining } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore } from './rule.js';

export class UpsetBrewingRule implements AlertRule {
  readonly name = 'upset-brewing';

  evaluate(game: Game): Alert[] {
    const { homeTeam: home, awayTeam: away } = game;
    if (!home.seed || !away.seed || home.seed === away.seed) return [];

    const seedDiff = Math.abs(home.seed - away.seed);
    const higherSeed = home.seed > away.seed ? home : away;
    const lowerSeed = home.seed > away.seed ? away : home;
    const isUnderdogLeading = higherSeed.score > lowerSeed.score;
    if (!isUnderdogLeading) return [];

    if (!isLive(game)) return [];
    if (estimateSecondsRemaining(game) > 600) return [];

    const underdogWinPct = higherSeed.id === game.homeTeam.id ? game.homeWinPct : game.awayWinPct;
    if (underdogWinPct !== undefined && underdogWinPct < 0.35) return [];

    const score = formatScore(game.awayTeam, game.homeTeam);
    const underdogPctStr = underdogWinPct !== undefined
      ? ` | ${higherSeed.shortName} ${Math.round(underdogWinPct * 100)}% to win`
      : '';
    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline: `UPSET ALERT: #${higherSeed.seed} ${higherSeed.shortName} leads #${lowerSeed.seed} ${lowerSeed.shortName}!`,
      body: `${score} | ${game.clock} - 2nd Half | ${seedDiff}-seed diff${underdogPctStr}`,
      priority: 'high',
      createdAt: new Date(),
    }];
  }
}
