import { describe, it, expect } from 'vitest';
import { ScoringRunRule } from '../../src/rules/scoring-run.js';
import { makeGame, makePlay } from './helpers.js';

const rule = new ScoringRunRule();

describe('ScoringRunRule', () => {
  it('fires when home team goes on 15-0 run', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 2, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 5, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 8, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 11, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 14, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 17, awayScore: 10 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 17 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 10 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain('home');
    expect(alerts[0]!.headline).toContain('17-0');
    expect(alerts[0]!.body).toBe('AWY 10, HME 17 | 2nd Half | 10:00');
  });

  it('fires when away team goes on 15-0 run', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 10, awayScore: 0 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 10, awayScore: 3 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 10, awayScore: 6 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 10, awayScore: 9 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 10, awayScore: 12 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 10, awayScore: 15 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 10 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 15 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain('away');
  });

  it('does not fire when opponent scored most recently', () => {
    // home scored 17 unanswered then away scored — run is broken
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 17, awayScore: 0 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 17, awayScore: 3 }), // opponent scores — breaks run
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 17 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 3 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when run is < 15', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 3, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 6, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 9, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 12, awayScore: 10 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 12 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 10 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire without plays', () => {
    const game = makeGame();
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('uses threshold-based alert ID — 17-run fires with threshold 15', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 17, awayScore: 10 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 17 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 10 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toMatch(/:15$/);
  });

  it('uses threshold-based alert ID — 20-run fires with threshold 20', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 20, awayScore: 10 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 20 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 10 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toMatch(/:20$/);
  });

  it('fires for finished games', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 15, awayScore: 10 }),
    ];
    const game = makeGame({
      status: 'post',
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 15 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 10 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(1);
  });
});
