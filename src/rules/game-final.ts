import { Game, margin, isFinished, leadingTeam } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, otLabel, gameCardContext } from './rule.js';
import { pick, WIN_VERBS, BLOWOUT_VERBS, CLOSE_WIN_VERBS } from './synonyms.js';

const BLOWOUT_MARGIN = 30;
const CLOSE_MARGIN = 5;

function distanceFromBasket(coord: { x: number; y: number }): number {
  return Math.round(Math.sqrt((coord.x - 25) ** 2 + coord.y ** 2));
}

export class GameFinalRule implements AlertRule {
  readonly name = 'game-final';

  evaluate(game: Game): Alert[] {
    if (!isFinished(game)) return [];

    const winner = leadingTeam(game);
    if (!winner) return [];

    const loser = game.homeTeam === winner ? game.awayTeam : game.homeTeam;
    const diff = margin(game);
    const score = formatScore(game.awayTeam, game.homeTeam);

    const isOT = game.period >= 3;
    const isBlowout = diff >= BLOWOUT_MARGIN;
    const isClose = !isOT && diff <= CLOSE_MARGIN;
    const isUpset = !!(winner.seed && loser.seed && winner.seed > loser.seed);

    // Buzzer beater: last period, scoring play at clock 0, non-FT, by winner
    let isBuzzerBeater = false;
    let buzzerDistanceFt = 0;
    for (const play of (game.plays ?? []).filter((p) => p.period === game.period)) {
      if (!play.scoringPlay || play.clockSeconds !== 0 || play.teamId === null) continue;
      if (play.text.toLowerCase().includes('free throw')) continue;
      const scoringTeam = play.teamId === game.homeTeam.id ? game.homeTeam : game.awayTeam;
      if (scoringTeam !== winner) continue;
      isBuzzerBeater = true;
      if (play.coordinate) buzzerDistanceFt = distanceFromBasket(play.coordinate);
      break;
    }

    let headline: string;
    let priority: Alert['priority'];
    const otSuffix = isOT ? ` in ${otLabel(game.period)}` : '';

    if (isBuzzerBeater) {
      const verb = pick(WIN_VERBS, game.id);
      if (buzzerDistanceFt > 0) {
        headline = `${winner.shortName} ${verb} ${loser.shortName} on a ${buzzerDistanceFt}-foot buzzer beater!`;
      } else {
        headline = `${winner.shortName} ${verb} ${loser.shortName} on a buzzer beater${isOT ? ' in OT' : ''}!`;
      }
      priority = 'high';
    } else if (isUpset) {
      headline = `UPSET: #${winner.seed} ${winner.shortName} defeats #${loser.seed} ${loser.shortName}${otSuffix}!`;
      priority = 'high';
    } else if (isOT) {
      headline = `${winner.shortName} ${pick(WIN_VERBS, game.id)} ${loser.shortName}${otSuffix}!`;
      priority = 'high';
    } else if (isBlowout) {
      headline = `${winner.shortName} ${pick(BLOWOUT_VERBS, game.id)} ${loser.shortName} by ${diff}!`;
      priority = 'medium';
    } else if (isClose) {
      headline = `${winner.shortName} ${pick(CLOSE_WIN_VERBS, game.id)} ${loser.shortName} in a thriller!`;
      priority = 'medium';
    } else {
      headline = `${winner.shortName} ${pick(WIN_VERBS, game.id)} ${loser.shortName}!`;
      priority = 'low';
    }

    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline,
      body: `Final: ${score}`,
      priority,
      createdAt: new Date(),
      context: gameCardContext(game, 'FINAL', priority),
    }];
  }
}
