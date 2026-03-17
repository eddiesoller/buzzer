import { describe, it, expect } from 'vitest';
import { mergeSummaryIntoGame } from '../../src/espn/summary-parser.js';
import { EspnSummaryResponse } from '../../src/types/espn.js';
import { makeGame } from '../rules/helpers.js';

const STAT_KEYS = [
  'minutes',
  'fieldGoalsMade-fieldGoalsAttempted',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
  'freeThrowsMade-freeThrowsAttempted',
  'offensiveRebounds',
  'defensiveRebounds',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fouls',
  'plusMinus',
  'points',
];

function makeStats(overrides: Partial<Record<string, string>> = {}): string[] {
  const defaults: Record<string, string> = {
    minutes: '32:15',
    'fieldGoalsMade-fieldGoalsAttempted': '8-15',
    'threePointFieldGoalsMade-threePointFieldGoalsAttempted': '2-5',
    'freeThrowsMade-freeThrowsAttempted': '6-7',
    offensiveRebounds: '2',
    defensiveRebounds: '8',
    rebounds: '10',
    assists: '5',
    steals: '2',
    blocks: '1',
    turnovers: '3',
    fouls: '2',
    plusMinus: '12',
    points: '24',
    ...overrides,
  };
  return STAT_KEYS.map((k) => defaults[k] ?? '0');
}

function makeSummaryWithPlays(): EspnSummaryResponse {
  return {
    boxscore: { teams: [], players: [] },
    plays: [
      {
        id: '1',
        sequenceNumber: '1',
        scoringPlay: false,
        homeScore: 0,
        awayScore: 0,
        period: { number: 1, displayValue: '1st Half' },
        clock: { displayValue: '20:00' },
        team: { id: 'home' },
        text: 'Jump ball',
      },
      {
        id: '2',
        sequenceNumber: '2',
        scoringPlay: true,
        homeScore: 2,
        awayScore: 0,
        period: { number: 1, displayValue: '1st Half' },
        clock: { displayValue: '19:30' },
        team: { id: 'home' },
        text: 'Made layup',
      },
      {
        id: '3',
        sequenceNumber: '3',
        scoringPlay: true,
        homeScore: 2,
        awayScore: 3,
        period: { number: 1, displayValue: '1st Half' },
        clock: { displayValue: '19:00' },
        team: { id: 'away' },
        text: 'Made three',
      },
    ],
  };
}

function makeSummary(statsOverrides: Partial<Record<string, string>> = {}): EspnSummaryResponse {
  return {
    boxscore: {
      teams: [],
      players: [{
        team: { id: 'home', displayName: 'Home', shortDisplayName: 'Home', abbreviation: 'HME' },
        statistics: [{
          names: STAT_KEYS,
          keys: STAT_KEYS,
          labels: STAT_KEYS,
          descriptions: STAT_KEYS,
          totals: [],
          athletes: [{
            athlete: { id: 'p1', displayName: 'John Doe', shortName: 'J. Doe' },
            starter: true,
            didNotPlay: false,
            ejected: false,
            stats: makeStats(statsOverrides),
          }],
        }],
      }],
    },
  };
}

describe('mergeSummaryIntoGame', () => {
  it('merges player stats into game', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummary());
    expect(result.players).toHaveLength(1);
    const p = result.players![0]!;
    expect(p.playerId).toBe('p1');
    expect(p.playerName).toBe('John Doe');
    expect(p.teamId).toBe('home');
    expect(p.points).toBe(24);
    expect(p.rebounds).toBe(10);
    expect(p.assists).toBe(5);
    expect(p.steals).toBe(2);
    expect(p.blocks).toBe(1);
  });

  it('parses minutes in MM:SS format', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummary({ minutes: '32:30' }));
    const p = result.players![0]!;
    expect(p.minutesPlayed).toBeCloseTo(32.5, 1);
  });

  it('parses fractional stats like FG made/attempted', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummary({ 'fieldGoalsMade-fieldGoalsAttempted': '10-18' }));
    const p = result.players![0]!;
    expect(p.fieldGoalsMade).toBe(10);
    expect(p.fieldGoalsAttempted).toBe(18);
  });

  it('skips players marked as didNotPlay', () => {
    const summary: EspnSummaryResponse = {
      boxscore: {
        teams: [],
        players: [{
          team: { id: 'home', displayName: 'Home', shortDisplayName: 'Home', abbreviation: 'HME' },
          statistics: [{
            names: STAT_KEYS,
            keys: STAT_KEYS,
            labels: STAT_KEYS,
            descriptions: STAT_KEYS,
            totals: [],
            athletes: [{
              athlete: { id: 'p1', displayName: 'DNP Player', shortName: 'DNP' },
              starter: false,
              didNotPlay: true,
              ejected: false,
              stats: makeStats(),
            }],
          }],
        }],
      },
    };
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, summary);
    expect(result.players).toHaveLength(0);
  });

  it('returns game unchanged when no boxscore', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, {});
    expect(result).toBe(game);
    expect(result.players).toBeUndefined();
  });

  it('parses plays from summary', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummaryWithPlays());
    expect(result.plays).toHaveLength(3);
    const [p0, p1, p2] = result.plays!;
    expect(p0!.scoringPlay).toBe(false);
    expect(p0!.teamId).toBe('home');
    expect(p0!.clockSeconds).toBe(1200); // 20:00
    expect(p1!.scoringPlay).toBe(true);
    expect(p1!.homeScore).toBe(2);
    expect(p1!.awayScore).toBe(0);
    expect(p1!.clockSeconds).toBe(1170); // 19:30
    expect(p2!.teamId).toBe('away');
    expect(p2!.awayScore).toBe(3);
  });

  it('returns empty plays array when summary has no plays', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummary());
    expect(result.plays).toEqual([]);
  });

  it('sets starter flag correctly', () => {
    const game = makeGame();
    const result = mergeSummaryIntoGame(game, makeSummary());
    expect(result.players![0]!.starter).toBe(true);
  });
});
