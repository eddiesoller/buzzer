import { describe, it, expect } from 'vitest';
import { ComebackRule } from '../../src/rules/comeback.js';
import { makeGame, makePlay } from './helpers.js';

const rule = new ComebackRule();

describe('ComebackRule', () => {
  it('fires when home team erases 15+ point deficit and takes lead', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 20 }), // away up 20
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 10, awayScore: 20 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 22, awayScore: 20 }), // home now leads
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 22 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 20 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain('comeback');
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires when away team erases 15+ point deficit and takes lead', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 20, awayScore: 0 }), // home up 20
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 20, awayScore: 10 }),
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 20, awayScore: 22 }), // away now leads
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 20 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 22 },
      plays,
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain('comeback');
  });

  it('does not fire when max deficit was < 15', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 12 }), // away up 12 (< 15)
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 20, awayScore: 12 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 20 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 12 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when team erased deficit but still trails', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 20 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 18, awayScore: 20 }),
    ];
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 18 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 20 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire without plays', () => {
    const game = makeGame({
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 62 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 60 },
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires for finished games with a completed comeback', () => {
    const plays = [
      makePlay({ scoringPlay: true, teamId: 'away', homeScore: 0, awayScore: 20 }),
      makePlay({ scoringPlay: true, teamId: 'home', homeScore: 22, awayScore: 20 }),
    ];
    const game = makeGame({
      status: 'post',
      homeTeam: { id: 'home', name: 'Home', shortName: 'Home', abbreviation: 'HME', score: 22 },
      awayTeam: { id: 'away', name: 'Away', shortName: 'Away', abbreviation: 'AWY', score: 20 },
      plays,
    });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire for pre-game', () => {
    const game = makeGame({ status: 'pre' });
    expect(rule.evaluate(game)).toHaveLength(0);
  });
});
