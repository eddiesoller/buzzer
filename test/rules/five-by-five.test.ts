import { describe, it, expect } from 'vitest';
import { FiveByFiveRule } from '../../src/rules/five-by-five.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new FiveByFiveRule();

describe('FiveByFiveRule', () => {
  it('fires when player has 5+ in all 5 categories', () => {
    const player = makePlayer({ playerId: 'p1', points: 6, rebounds: 5, assists: 5, steals: 5, blocks: 5 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('five-by-five:game1:p1');
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires approaching when 4 cats are at 5+ and all are at 4+ with < 3 min left', () => {
    const player = makePlayer({ playerId: 'p1', points: 5, rebounds: 5, assists: 5, steals: 5, blocks: 4 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('five-by-five-approaching:game1:p1');
  });

  it('does not fire approaching when not all cats are at 4+', () => {
    // 4 cats at 5+, but the 5th is at 3 — not close enough
    const player = makePlayer({ playerId: 'p1', points: 5, rebounds: 5, assists: 5, steals: 5, blocks: 3 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire approaching with > 3 min remaining', () => {
    const player = makePlayer({ playerId: 'p1', points: 5, rebounds: 5, assists: 5, steals: 5, blocks: 4 });
    const game = makeGame({ clockSeconds: 600, players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when only 4 categories reach 5', () => {
    const player = makePlayer({ playerId: 'p1', points: 5, rebounds: 5, assists: 5, steals: 5, blocks: 0 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire approaching in same eval as achieved', () => {
    const player = makePlayer({ playerId: 'p1', points: 5, rebounds: 5, assists: 5, steals: 5, blocks: 5 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id === 'five-by-five:game1:p1')).toBe(true);
    expect(alerts.some((a) => a.id === 'five-by-five-approaching:game1:p1')).toBe(false);
  });
});
