import { describe, it, expect } from 'vitest';
import { MultiDoubleRule } from '../../src/rules/multi-double.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new MultiDoubleRule();

describe('MultiDoubleRule', () => {
  describe('double-double', () => {
    it('fires medium alert at double-double:<gameId>:<playerId> when 2 categories are 10+', () => {
      const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 5 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe('double-double:game1:p1');
      expect(alerts[0]!.priority).toBe('medium');
    });

    it('body includes score, period, and clock', () => {
      const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts[0]!.body).toBe('AWAY 45, HOME 50 | 2nd Half | 10:00');
    });

    it('does not fire a double-double approaching alert', () => {
      const player = makePlayer({ playerId: 'p1', points: 9, rebounds: 8, assists: 3 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('triple-double', () => {
    it('fires high alert at triple-double:<gameId>:<playerId> when 3 categories are 10+', () => {
      const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 11 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe('triple-double:game1:p1');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('does NOT also fire a double-double alert for a triple-double player', () => {
      const player = makePlayer({ playerId: 'p1', points: 15, rebounds: 10, assists: 11 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === 'double-double:game1:p1')).toBe(false);
      expect(alerts).toHaveLength(1);
    });

    it('fires approaching when 3 categories are 8+ with < 3 min left', () => {
      const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe('triple-double-approaching:game1:p1');
    });

    it('approaching body includes score, period, clock, and "remaining"', () => {
      const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts[0]!.body).toBe('AWAY 45, HOME 50 | 2nd Half | 10:00 remaining');
    });

    it('does not fire approaching with > 3 min remaining', () => {
      const player = makePlayer({ playerId: 'p1', points: 8, rebounds: 9, assists: 8 });
      const game = makeGame({ clockSeconds: 600, players: [player] });
      expect(rule.evaluate(game)).toHaveLength(0);
    });

    it('does not fire approaching in same eval as achieved', () => {
      const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === 'triple-double:game1:p1')).toBe(true);
      expect(alerts.some((a) => a.id === 'triple-double-approaching:game1:p1')).toBe(false);
      expect(alerts).toHaveLength(1);
    });
  });

  describe('quadruple-double', () => {
    it('fires high alert at quadruple-double:<gameId>:<playerId> when 4 categories are 10+', () => {
      const player = makePlayer({ playerId: 'p1', points: 12, rebounds: 10, assists: 11, steals: 10, blocks: 0 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.id).toBe('quadruple-double:game1:p1');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('does NOT also fire triple-double or double-double alerts for a quadruple-double player', () => {
      const player = makePlayer({ playerId: 'p1', points: 12, rebounds: 10, assists: 11, steals: 10, blocks: 0 });
      const game = makeGame({ players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === 'triple-double:game1:p1')).toBe(false);
      expect(alerts.some((a) => a.id === 'double-double:game1:p1')).toBe(false);
      expect(alerts).toHaveLength(1);
    });

    it('fires approaching when 4 categories are 8+ with < 3 min left', () => {
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

    it('does not fire approaching in same eval as achieved', () => {
      const player = makePlayer({ playerId: 'p1', points: 10, rebounds: 10, assists: 10, steals: 10, blocks: 0 });
      const game = makeGame({ clockSeconds: 100, players: [player] });
      const alerts = rule.evaluate(game);
      expect(alerts.some((a) => a.id === 'quadruple-double:game1:p1')).toBe(true);
      expect(alerts.some((a) => a.id === 'quadruple-double-approaching:game1:p1')).toBe(false);
      expect(alerts).toHaveLength(1);
    });
  });
});
