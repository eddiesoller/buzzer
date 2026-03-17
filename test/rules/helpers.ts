import { Game, Play, Team, PlayerStats } from '../../src/types/game.js';
import { Alert } from '../../src/types/alert.js';

export function makeTeam(overrides: Partial<Team> & { id: string }): Team {
  return {
    name: 'Team ' + overrides.id,
    shortName: overrides.id,
    abbreviation: overrides.id.toUpperCase(),
    score: 50,
    ...overrides,
  };
}

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game1',
    status: 'in',
    period: 2,
    clock: '10:00',
    clockSeconds: 600,
    homeTeam: makeTeam({ id: 'home', score: 50 }),
    awayTeam: makeTeam({ id: 'away', score: 45 }),
    startTime: '2026-03-15T20:00Z',
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<Alert> & { id: string }): Alert {
  return {
    rule: 'test',
    gameId: 'game1',
    headline: 'Test headline',
    body: 'Test body',
    priority: 'medium',
    createdAt: new Date(),
    ...overrides,
  };
}

export function makePlay(overrides: Partial<Play> = {}): Play {
  return {
    teamId: null,
    homeScore: 0,
    awayScore: 0,
    scoringPlay: false,
    period: 1,
    clockSeconds: 600,
    ...overrides,
  };
}

export function makePlayer(overrides: Partial<PlayerStats> & { playerId: string }): PlayerStats {
  return {
    playerName: 'Player ' + overrides.playerId,
    teamId: 'home',
    minutesPlayed: 20,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointMade: 0,
    threePointAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    fouls: 0,
    plusMinus: 0,
    starter: true,
    ...overrides,
  };
}
