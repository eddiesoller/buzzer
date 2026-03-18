import { describe, it, expect } from 'vitest';
import { BigShotRule } from '../../src/rules/big-shot.js';
import { makeGame, makePlay } from './helpers.js';

const rule = new BigShotRule();

describe('BigShotRule', () => {
  describe('buzzer beater', () => {
    it('fires for scoring play with < 3 seconds in period 2', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 1, period: 2, sequenceNumber: 42 });
      const game = makeGame();
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('Buzzer beater');
      expect(alert!.priority).toBe('high');
      expect(alert!.id).toBe('big-shot:game1:42');
    });

    it('does not fire in period 1 (halftime buzzer)', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 1, period: 1 });
      const game = makeGame();
      expect(rule.evaluate(play, game)).toBeNull();
    });

    it('fires in OT periods (period >= 2)', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 0, period: 3 });
      const game = makeGame();
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.priority).toBe('high');
    });

    it('does not fire if not a scoring play', () => {
      const play = makePlay({ scoringPlay: false, clockSeconds: 1, period: 2 });
      const game = makeGame();
      expect(rule.evaluate(play, game)).toBeNull();
    });
  });

  describe('long-range shot', () => {
    it('fires for shot at coordinate (25, 65) — 65-foot shot', () => {
      const play = makePlay({
        scoringPlay: true,
        clockSeconds: 600,
        period: 2,
        coordinate: { x: 25, y: 65 },
        sequenceNumber: 10,
      });
      const game = makeGame();
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('65');
      expect(alert!.headline).toContain('shot');
      expect(alert!.priority).toBe('medium');
    });

    it('does not fire for short shot near basket (26, 1) — ~1 foot', () => {
      const play = makePlay({
        scoringPlay: true,
        clockSeconds: 600,
        period: 2,
        coordinate: { x: 26, y: 1 },
      });
      const game = makeGame();
      expect(rule.evaluate(play, game)).toBeNull();
    });

    it('does not fire without coordinate data', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2 });
      const game = makeGame();
      expect(rule.evaluate(play, game)).toBeNull();
    });
  });

  describe('combined buzzer beater + long range', () => {
    it('produces a single high-priority alert mentioning distance', () => {
      const play = makePlay({
        scoringPlay: true,
        clockSeconds: 1,
        period: 2,
        coordinate: { x: 25, y: 65 },
        sequenceNumber: 99,
      });
      const game = makeGame();
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('65');
      expect(alert!.headline).toContain('buzzer beater');
      expect(alert!.priority).toBe('high');
    });
  });

  describe('distance formula', () => {
    it('(25, 1) → 1 ft (no alert — not long-range, not buzzer)', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2, coordinate: { x: 25, y: 1 } });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });

    it('(5, 21) → 29 ft (no alert — below 40 ft threshold)', () => {
      const play = makePlay({
        scoringPlay: true,
        clockSeconds: 600,
        period: 2,
        coordinate: { x: 5, y: 21 },
      });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });

    it('(25, 47) → 47 ft (long-range alert)', () => {
      const play = makePlay({
        scoringPlay: true,
        clockSeconds: 600,
        period: 2,
        coordinate: { x: 25, y: 47 },
      });
      const alert = rule.evaluate(play, makeGame());
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('47');
    });
  });
});
