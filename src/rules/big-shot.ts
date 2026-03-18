import { Play, Game } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { PlayRule } from './play-rule.js';
import { makeAlertId, formatScore } from './rule.js';

const LONG_RANGE_FEET = 40;
const BUZZER_SECONDS = 3;

function distanceFromBasket(coord: { x: number; y: number }): number {
  return Math.round(Math.sqrt((coord.x - 25) ** 2 + coord.y ** 2));
}

export class BigShotRule implements PlayRule {
  readonly name = 'big-shot';

  evaluate(play: Play, game: Game): Alert | null {
    if (!play.scoringPlay) return null;

    const isBuzzerBeater = play.clockSeconds < BUZZER_SECONDS && play.period >= 2;

    let isLongRange = false;
    let distanceFt = 0;
    if (play.coordinate) {
      distanceFt = distanceFromBasket(play.coordinate);
      isLongRange = distanceFt >= LONG_RANGE_FEET;
    }

    if (!isBuzzerBeater && !isLongRange) return null;

    let headline: string;
    if (isBuzzerBeater && isLongRange) {
      headline = `${distanceFt}-foot buzzer beater!`;
    } else if (isBuzzerBeater) {
      headline = 'Buzzer beater!';
    } else {
      headline = `${distanceFt}-foot shot!`;
    }

    const score = formatScore(game.awayTeam, game.homeTeam);
    const priority = isBuzzerBeater ? 'high' : 'medium';

    return {
      id: makeAlertId(this.name, game.id, String(play.sequenceNumber)),
      rule: this.name,
      gameId: game.id,
      headline,
      body: `${score} | ${game.clock}`,
      priority,
      createdAt: new Date(),
    };
  }
}
