import { describe, it, expect } from 'vitest';
import { CloseGameRule } from '../../src/rules/close-game.js';
import { makeGame } from './helpers.js';

const rule = new CloseGameRule();

describe('CloseGameRule', () => {
  it('fires when margin ≤ 5 with ≤ 5 minutes left in 2nd half', () => {
    const game = makeGame({ period: 2, clockSeconds: 240, homeTeam: { ...makeGame().homeTeam, score: 65 }, awayTeam: { ...makeGame().awayTeam, score: 63 } });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.rule).toBe('close-game');
  });

  it('does not fire in first half', () => {
    const game = makeGame({ period: 1, clockSeconds: 200 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when margin > 5', () => {
    const game = makeGame({ period: 2, clockSeconds: 200,
      homeTeam: { ...makeGame().homeTeam, score: 70 },
      awayTeam: { ...makeGame().awayTeam, score: 63 } });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when more than 5 minutes remain', () => {
    const game = makeGame({ period: 2, clockSeconds: 400,
      homeTeam: { ...makeGame().homeTeam, score: 65 },
      awayTeam: { ...makeGame().awayTeam, score: 63 } });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires only once per game regardless of when in the window it is evaluated', () => {
    const game1 = makeGame({ period: 2, clockSeconds: 240, homeTeam: { ...makeGame().homeTeam, score: 65 }, awayTeam: { ...makeGame().awayTeam, score: 63 } });
    const game2 = makeGame({ period: 2, clockSeconds: 60,  homeTeam: { ...makeGame().homeTeam, score: 67 }, awayTeam: { ...makeGame().awayTeam, score: 65 } });
    expect(rule.evaluate(game1)[0]!.id).toBe(rule.evaluate(game2)[0]!.id);
  });

  it('fires high priority on tie', () => {
    const game = makeGame({ period: 2, clockSeconds: 120,
      homeTeam: { ...makeGame().homeTeam, score: 65 },
      awayTeam: { ...makeGame().awayTeam, score: 65 } });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.priority).toBe('high');
  });

  describe('close final', () => {
    it('fires when finished in regulation with margin ≤ 5', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: { ...makeGame().homeTeam, score: 83 },
        awayTeam: { ...makeGame().awayTeam, score: 81 } });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toContain('close-game-final');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('does not fire when finished in OT', () => {
      const game = makeGame({ status: 'post', period: 3,
        homeTeam: { ...makeGame().homeTeam, score: 85 },
        awayTeam: { ...makeGame().awayTeam, score: 83 } });
      expect(rule.evaluate(game)).toHaveLength(0);
    });

    it('does not fire when margin > 5 at final', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: { ...makeGame().homeTeam, score: 90 },
        awayTeam: { ...makeGame().awayTeam, score: 83 } });
      expect(rule.evaluate(game)).toHaveLength(0);
    });

    it('has a different id from the live close-game alert', () => {
      const liveGame = makeGame({ period: 2, clockSeconds: 120,
        homeTeam: { ...makeGame().homeTeam, score: 65 },
        awayTeam: { ...makeGame().awayTeam, score: 63 } });
      const finalGame = makeGame({ status: 'post', period: 2,
        homeTeam: { ...makeGame().homeTeam, score: 65 },
        awayTeam: { ...makeGame().awayTeam, score: 63 } });
      expect(rule.evaluate(liveGame)[0]!.id).not.toBe(rule.evaluate(finalGame)[0]!.id);
    });
  });
});
