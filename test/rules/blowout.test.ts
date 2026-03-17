import { describe, it, expect } from 'vitest';
import { BlowoutRule } from '../../src/rules/blowout.js';
import { makeGame } from './helpers.js';

const rule = new BlowoutRule();

describe('BlowoutRule', () => {
  it('fires live alert with "leads" headline', () => {
    const game = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 80 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 45 }, period: 2 });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('blowout:game1');
    expect(alerts[0]!.headline).toContain('blowing out');
    expect(alerts[0]!.priority).toBe('low');
  });

  it('fires final alert with "beat" headline', () => {
    const game = makeGame({ status: 'post', homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 95 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 60 }, period: 2 });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('blowout-final:game1');
    expect(alerts[0]!.headline).toContain('blew out');
  });

  it('live and final alerts have different IDs so both can fire', () => {
    const live  = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 80 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 45 } });
    const final = makeGame({ status: 'post', homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 80 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 45 } });
    expect(rule.evaluate(live)[0]!.id).not.toBe(rule.evaluate(final)[0]!.id);
  });

  it('does not fire when margin < 30', () => {
    const game = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 65 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 45 }, period: 2 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires in 1st half when margin >= 30', () => {
    const game = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 50 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 15 }, period: 1 });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire for pre-game', () => {
    const game = makeGame({ status: 'pre', period: 0 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires only once per game regardless of margin growth', () => {
    const game = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 80 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 48 }, period: 2 });
    const game2 = makeGame({ homeTeam: { id: 'home', name: 'Home', shortName: 'H', abbreviation: 'HME', score: 90 }, awayTeam: { id: 'away', name: 'Away', shortName: 'A', abbreviation: 'AWY', score: 48 }, period: 2 });
    expect(rule.evaluate(game)[0]!.id).toBe(rule.evaluate(game2)[0]!.id);
  });
});
