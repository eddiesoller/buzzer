import { Play, Game } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { PlayRule } from './play-rule.js';
import { makeAlertId, formatScore } from './rule.js';

const LONG_RANGE_FEET = 40;
const GO_AHEAD_SECONDS = 60;

function distanceFromBasket(coord: { x: number; y: number }): number {
  return Math.round(Math.sqrt((coord.x - 25) ** 2 + coord.y ** 2));
}

/** Returns the play immediately before this one in game.plays, or null. */
function prevPlay(play: Play, game: Game): Play | null {
  let best: Play | null = null;
  for (const p of game.plays ?? []) {
    if (p.sequenceNumber < play.sequenceNumber) {
      if (best === null || p.sequenceNumber > best.sequenceNumber) best = p;
    }
  }
  return best;
}

export class BigShotRule implements PlayRule {
  readonly name = 'big-shot';

  evaluate(play: Play, game: Game): Alert | null {
    if (!play.scoringPlay) return null;

    const isFreethrow = play.text.toLowerCase().includes('free throw');
    const scoringTeamIsHome = play.teamId !== null && play.teamId === game.homeTeam.id;

    // Post-play outcome
    const postScoringScore = scoringTeamIsHome ? play.homeScore : play.awayScore;
    const postOpponentScore = scoringTeamIsHome ? play.awayScore : play.homeScore;
    const scoringTeamNowLeads = postScoringScore > postOpponentScore;
    const scoringTeamTied = postScoringScore === postOpponentScore;

    // Pre-play state: was the scoring team not already leading?
    // Without a known teamId or a prior play, defaults to false (no alert).
    let scoringTeamWasNotLeading = false;
    if (play.teamId !== null) {
      const prior = prevPlay(play, game);
      if (prior !== null) {
        const preScoringScore = scoringTeamIsHome ? prior.homeScore : prior.awayScore;
        const preOpponentScore = scoringTeamIsHome ? prior.awayScore : prior.homeScore;
        scoringTeamWasNotLeading = preScoringScore <= preOpponentScore;
      }
    }

    // Buzzer beater: exactly 0 seconds, not FT, 2nd half or OT,
    // scoring team was not already leading, now leads or ties
    const isBuzzerBeater =
      !isFreethrow &&
      play.clockSeconds === 0 &&
      play.period >= 2 &&
      scoringTeamWasNotLeading &&
      (scoringTeamNowLeads || scoringTeamTied);

    // Long-range: 40+ feet, not a free throw
    let isLongRange = false;
    let distanceFt = 0;
    if (!isFreethrow && play.coordinate) {
      distanceFt = distanceFromBasket(play.coordinate);
      isLongRange = distanceFt >= LONG_RANGE_FEET;
    }

    // Go-ahead: last 60 seconds (clock > 0), 2nd half or OT,
    // scoring team was not already leading, now leads
    const isGoAhead =
      play.clockSeconds > 0 &&
      play.clockSeconds <= GO_AHEAD_SECONDS &&
      play.period >= 2 &&
      scoringTeamWasNotLeading &&
      scoringTeamNowLeads;

    if (!isBuzzerBeater && !isLongRange && !isGoAhead) return null;

    let headline: string;
    const priority: Alert['priority'] = isBuzzerBeater ? 'high' : 'medium';

    if (isBuzzerBeater && isLongRange) {
      headline = `${distanceFt}-foot buzzer beater!`;
    } else if (isBuzzerBeater) {
      headline = 'Buzzer beater!';
    } else if (isGoAhead && isLongRange) {
      headline = `Go-ahead ${distanceFt}-foot shot!`;
    } else if (isGoAhead) {
      headline = isFreethrow ? 'Go-ahead free throw!' : 'Go-ahead basket!';
    } else {
      headline = `${distanceFt}-foot shot!`;
    }

    const score = formatScore(game.awayTeam, game.homeTeam);

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
