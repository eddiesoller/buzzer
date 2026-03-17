import { describe, it, expect } from 'vitest';
import { QuadrupleDoubleRule } from '../../src/rules/quadruple-double.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new QuadrupleDoubleRule();

describe('QuadrupleDoubleRule', () => {
  it('fires achieved when player has 10+ in 4 categories', () => {
    const player = makePlayer({ playerId: 'p1', points: 12, rebounds: 10, assists: 11, steals: 10, blocks: 0 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('quadruple-double:game1:p1');
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires approaching when player has 8+ in 4 categories with < 3 min left', () => {
    const player = makePlayer({ playerId: 'p1', points: 9, rebounds: 8, assists: 8, steals: 9, blocks: 0 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('quadruple-double-approaching:game1:p1');
  });

  it('does not fire approaching with > 3 min remaining', () => {
    const player = makePlayer({ playerId: 'p1', points: 9, rebounds: 8, assists: 8, steals: 9, blocks: 0 });
    const game = makeGame({ clockSeconds: 600, players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when only 3 categories reach 10+', () => {
    const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 10, steals: 2, blocks: 0 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire approaching in same eval as achieved', () => {
    const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10, steals: 10, blocks: 0 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id === 'quadruple-double:game1:p1')).toBe(true);
    expect(alerts.some((a) => a.id === 'quadruple-double-approaching:game1:p1')).toBe(false);
  });
});
