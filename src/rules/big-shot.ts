import { Play, Game, PlayerStats, Team } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { PlayRule } from './play-rule.js';
import { makeAlertId } from './rule.js';

const LONG_RANGE_FEET = 40;
const GO_AHEAD_SECONDS = 60;

function distanceFromBasket(coord: { x: number; y: number }): number {
  return Math.round(Math.sqrt((coord.x - 25) ** 2 + coord.y ** 2));
}

function findScoringTeam(play: Play, game: Game): Team | null {
  if (play.teamId === game.homeTeam.id) return game.homeTeam;
  if (play.teamId === game.awayTeam.id) return game.awayTeam;
  return null;
}

function findScoringPlayer(play: Play, game: Game): PlayerStats | null {
  const teamPlayers = (game.players ?? []).filter((p) => p.teamId === play.teamId);
  return teamPlayers.find((p) => play.text.includes(p.playerName)) ?? null;
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
      // Single-pass find of the play immediately before this one by sequence number
      let prior: Play | null = null;
      for (const p of game.plays ?? []) {
        if (p.sequenceNumber < play.sequenceNumber &&
            (prior === null || p.sequenceNumber > prior.sequenceNumber)) {
          prior = p;
        }
      }
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

    // Go-ahead: last 60 seconds (clock > 0, or clock=0 for free throws), 2nd half or OT,
    // scoring team was not already leading, now leads
    const isGoAhead =
      (play.clockSeconds > 0 || isFreethrow) &&
      play.clockSeconds <= GO_AHEAD_SECONDS &&
      play.period >= 2 &&
      scoringTeamWasNotLeading &&
      scoringTeamNowLeads;

    if (!isBuzzerBeater && !isLongRange && !isGoAhead) return null;

    const priority: Alert['priority'] = isBuzzerBeater ? 'high' : 'medium';
    const player = findScoringPlayer(play, game);
    const team = findScoringTeam(play, game);
    const playerPrefix = player ? `${player.playerName} - ` : '';

    let shotDesc: string;
    if (isBuzzerBeater && isLongRange) {
      shotDesc = `${distanceFt}-foot buzzer beater!`;
    } else if (isBuzzerBeater) {
      shotDesc = 'Buzzer beater!';
    } else if (isGoAhead && isLongRange) {
      shotDesc = `Go-ahead ${distanceFt}-foot shot!`;
    } else if (isGoAhead) {
      shotDesc = isFreethrow ? 'Go-ahead free throw!' : 'Go-ahead basket!';
    } else {
      shotDesc = `${distanceFt}-foot shot!`;
    }

    const headline = `${playerPrefix}${shotDesc}`;
    const scoreStr = `${game.awayTeam.abbreviation} ${play.awayScore}, ${game.homeTeam.abbreviation} ${play.homeScore}`;
    const teamPrefix = team ? `${team.abbreviation} | ` : '';

    return {
      id: makeAlertId(this.name, game.id, String(play.sequenceNumber)),
      rule: this.name,
      gameId: game.id,
      headline,
      body: `${teamPrefix}${scoreStr} | ${play.clockDisplay}`,
      priority,
      createdAt: new Date(),
    };
  }
}
