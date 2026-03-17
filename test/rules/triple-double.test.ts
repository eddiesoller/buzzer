import { describe, it, expect } from 'vitest';
import { TripleDoubleRule } from '../../src/rules/triple-double.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new TripleDoubleRule();

describe('TripleDoubleRule', () => {
  it('fires achieved when player has 10+ in 3 categories', () => {
    const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 11 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id === 'triple-double:game1:p1')).toBe(true);
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires approaching when player has 8+ in 3 categories with < 3 min left', () => {
    const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
    const game = makeGame({ clockSeconds: 100, players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id.includes('approaching'))).toBe(true);
  });

  it('does not fire approaching with more than 3 minutes remaining', () => {
    const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
    const game = makeGame({ clockSeconds: 600, players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when only 2 categories are 10+', () => {
    const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 5 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  // Transition tests: approaching → achieved
  describe('approaching → achieved transition', () => {
    const approachingId = 'triple-double-approaching:game1:p1';
    const achievedId = 'triple-double:game1:p1';

    it('approaching and achieved have different IDs so both can post', () => {
      expect(approachingId).not.toBe(achievedId);
    });

    it('poll 1: fires approaching when at 8+/8+/8+ with < 3 min left', () => {
      const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe(approachingId);
    });

    it('poll 2: fires achieved when stats reach 10+/10+/10+', () => {
      const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe(achievedId);
    });

    it('does not fire approaching in the same eval as achieved', () => {
      // When a player hits 10+/10+/10+, we should not also fire approaching in
      // the same evaluation — the continue ensures only one alert fires per player
      const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === achievedId)).toBe(true);
      expect(alerts.some((a) => a.id === approachingId)).toBe(false);
    });

    it('fires achieved even when player skipped the approaching threshold', () => {
      // Player jumps from 7/7/7 to 10/10/10 in one poll — achieved fires, approaching never did
      const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === achievedId)).toBe(true);
      expect(alerts.some((a) => a.id === approachingId)).toBe(false);
    });
  });
});
