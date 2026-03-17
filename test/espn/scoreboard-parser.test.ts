import { describe, it, expect } from 'vitest';
import { parseScoreboard } from '../../src/espn/scoreboard-parser.js';
import { EspnScoreboardResponse } from '../../src/types/espn.js';

function makeScoreboard(overrides: Partial<{
  state: 'pre' | 'in' | 'post';
  homeScore: string;
  awayScore: string;
  period: number;
  clock: number;
  displayClock: string;
  homeSeed: number;
  awaySeed: number;
}>): EspnScoreboardResponse {
  const o = { state: 'in', homeScore: '50', awayScore: '45', period: 2,
    clock: 300, displayClock: '5:00', homeSeed: 1, awaySeed: 16, ...overrides };

  return {
    events: [{
      id: 'game1',
      date: '2026-03-15T20:00Z',
      name: 'Duke vs Fairleigh Dickinson',
      shortName: 'DUKE vs FDU',
      status: {
        clock: o.clock,
        displayClock: o.displayClock,
        period: o.period,
        type: {
          id: '2',
          name: 'STATUS_IN_PROGRESS',
          state: o.state,
          completed: o.state === 'post',
          description: '2nd Half',
          detail: `${o.displayClock} - 2nd Half`,
          shortDetail: `${o.displayClock} - 2H`,
        },
      },
      competitions: [{
        id: 'game1',
        date: '2026-03-15T20:00Z',
        status: {
          clock: o.clock,
          displayClock: o.displayClock,
          period: o.period,
          type: {
            id: '2',
            name: 'STATUS_IN_PROGRESS',
            state: o.state,
            completed: o.state === 'post',
            description: '2nd Half',
            detail: `${o.displayClock} - 2nd Half`,
            shortDetail: `${o.displayClock} - 2H`,
          },
        },
        competitors: [
          {
            id: 'home1',
            homeAway: 'home',
            score: o.homeScore,
            team: { id: 'team-duke', displayName: 'Duke Blue Devils',
              shortDisplayName: 'Duke', abbreviation: 'DUKE' },
            curatedRank: { current: o.homeSeed },
            records: [{ summary: '25-5', type: 'total' }],
          },
          {
            id: 'away1',
            homeAway: 'away',
            score: o.awayScore,
            team: { id: 'team-fdu', displayName: 'Fairleigh Dickinson',
              shortDisplayName: 'FDU', abbreviation: 'FDU' },
            curatedRank: { current: o.awaySeed },
            records: [{ summary: '20-10', type: 'total' }],
          },
        ],
      }],
    }],
  };
}

describe('parseScoreboard', () => {
  it('parses a live game correctly', () => {
    const games = parseScoreboard(makeScoreboard({ homeScore: '50', awayScore: '45' }));
    expect(games).toHaveLength(1);
    const game = games[0]!;
    expect(game.id).toBe('game1');
    expect(game.status).toBe('in');
    expect(game.period).toBe(2);
    expect(game.clock).toBe('5:00');
    expect(game.clockSeconds).toBe(300);
    expect(game.homeTeam.score).toBe(50);
    expect(game.awayTeam.score).toBe(45);
    expect(game.homeTeam.seed).toBe(1);
    expect(game.awayTeam.seed).toBe(16);
  });

  it('parses a finished game', () => {
    const games = parseScoreboard(makeScoreboard({ state: 'post', homeScore: '78', awayScore: '60' }));
    expect(games[0]!.status).toBe('post');
  });

  it('handles missing seed gracefully', () => {
    const scoreboard = makeScoreboard({});
    delete scoreboard.events[0]!.competitions[0]!.competitors[0]!.curatedRank;
    const games = parseScoreboard(scoreboard);
    expect(games[0]!.homeTeam.seed).toBeUndefined();
  });
});
