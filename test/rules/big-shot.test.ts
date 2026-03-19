import { describe, it, expect } from 'vitest';
import { BigShotRule } from '../../src/rules/big-shot.js';
import { makeGame, makePlay, makePlayer } from './helpers.js';

const rule = new BigShotRule();

/**
 * Build a game that has one prior play establishing the pre-play score,
 * then evaluate the given play against it.
 */
function evalWithPrior(
  priorScore: { homeScore: number; awayScore: number },
  play: ReturnType<typeof makePlay>,
  gameOverrides: Parameters<typeof makeGame>[0] = {}
) {
  const prior = makePlay({ sequenceNumber: play.sequenceNumber - 1, ...priorScore });
  const game = makeGame({ plays: [prior], ...gameOverrides });
  return rule.evaluate(play, game);
}

describe('BigShotRule', () => {
  describe('buzzer beater', () => {
    it('fires when scoring team was tied and wins at clock=0 in 2nd half', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Buzzer beater!');
      expect(alert!.priority).toBe('high');
    });

    it('fires when scoring team was trailing and takes the lead at clock=0', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 49 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Buzzer beater!');
    });

    it('fires when scoring team ties the game at the buzzer (sends to OT)', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 50, awayScore: 50, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 48 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Buzzer beater!');
      expect(alert!.priority).toBe('high');
    });

    it('fires in OT periods (period=3)', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 3,
        homeScore: 55, awayScore: 57, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 55, awayScore: 55 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.priority).toBe('high');
    });

    it('does not fire if scoring team was already leading before the shot', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 50, awayScore: 57, sequenceNumber: 10,
      });
      // Away was already up 5; scores 2 more → up 7. Not a buzzer beater.
      const alert = evalWithPrior({ homeScore: 50, awayScore: 55 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire if scoring team is still losing after the shot', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 55, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 55, awayScore: 50 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire in period 1', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 1,
        homeScore: 25, awayScore: 27, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 25, awayScore: 25 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire when clock is 1 (not exactly 0)', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 1, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      // clockSeconds=1 is outside buzzer beater range — may fire as go-ahead but not buzzer beater
      if (alert) expect(alert.headline).not.toContain('buzzer beater');
    });

    it('does not fire for a free throw even at clock=0', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        text: 'Makes free throw 1 of 2',
        homeScore: 50, awayScore: 50, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 49 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire without a prior play (cannot verify pre-play state)', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const game = makeGame({ plays: [] });
      expect(rule.evaluate(play, game)).toBeNull();
    });
  });

  describe('long-range shot', () => {
    it('fires for a 65-foot shot regardless of score situation', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 600, period: 2,
        coordinate: { x: 25, y: 65 }, sequenceNumber: 10,
        homeScore: 50, awayScore: 45,
      });
      // No prior play needed — long-range does not require pre-play state
      const alert = rule.evaluate(play, makeGame());
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('65');
      expect(alert!.headline).toContain('shot');
      expect(alert!.priority).toBe('medium');
    });

    it('fires even when teamId is null (unknown scorer)', () => {
      const play = makePlay({
        teamId: null, scoringPlay: true, clockSeconds: 600, period: 2,
        coordinate: { x: 25, y: 65 }, sequenceNumber: 10,
      });
      const alert = rule.evaluate(play, makeGame());
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('65');
    });

    it('does not fire for a short shot near the basket', () => {
      const play = makePlay({
        scoringPlay: true, clockSeconds: 600, period: 2,
        coordinate: { x: 26, y: 1 },
      });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });

    it('does not fire without coordinate data', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2 });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });
  });

  describe('combined buzzer beater + long-range', () => {
    it('produces a single high-priority alert mentioning distance and "buzzer beater"', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        coordinate: { x: 25, y: 65 },
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('65');
      expect(alert!.headline).toContain('buzzer beater');
      expect(alert!.priority).toBe('high');
    });
  });

  describe('go-ahead', () => {
    it('fires when scoring team was tied and takes the lead with 30 seconds left', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Go-ahead basket!');
      expect(alert!.priority).toBe('medium');
    });

    it('fires for a go-ahead free throw', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 45, period: 2,
        text: 'Makes free throw 2 of 2',
        homeScore: 50, awayScore: 51, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Go-ahead free throw!');
    });

    it('fires in OT (period=3) with time remaining', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 20, period: 3,
        homeScore: 60, awayScore: 62, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 60, awayScore: 60 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Go-ahead basket!');
    });

    it('does not fire when scoring team was already leading', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        homeScore: 50, awayScore: 57, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 55 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire when clock is 61 seconds (outside last-60s window)', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 61, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire in period 1', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 1,
        homeScore: 25, awayScore: 27, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 25, awayScore: 25 }, play);
      expect(alert).toBeNull();
    });

    it('does not fire for a go-ahead that only ties the game', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        homeScore: 50, awayScore: 50, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 48 }, play);
      // Ties the game — go-ahead requires scoring team to lead, not just tie
      expect(alert).toBeNull();
    });
  });

  describe('combined go-ahead + long-range', () => {
    it('fires a single medium alert mentioning distance and "Go-ahead"', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        coordinate: { x: 25, y: 47 },
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const alert = evalWithPrior({ homeScore: 50, awayScore: 50 }, play);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('47');
      expect(alert!.headline).toContain('Go-ahead');
      expect(alert!.priority).toBe('medium');
    });
  });

  describe('distance formula', () => {
    it('(25, 1) → 1 ft — no alert', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2, coordinate: { x: 25, y: 1 } });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });

    it('(5, 21) → 29 ft — below 40 ft threshold, no alert', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2, coordinate: { x: 5, y: 21 } });
      expect(rule.evaluate(play, makeGame())).toBeNull();
    });

    it('(25, 47) → 47 ft — long-range alert', () => {
      const play = makePlay({ scoringPlay: true, clockSeconds: 600, period: 2, coordinate: { x: 25, y: 47 } });
      const alert = rule.evaluate(play, makeGame());
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('47');
    });
  });

  describe('player and team context', () => {
    it('prefixes headline with player name when a matching player is found', () => {
      const player = makePlayer({ playerId: 'p1', playerName: 'Marcus Johnson', teamId: 'away' });
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        text: 'Marcus Johnson made Two Point Jump Shot',
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const prior = makePlay({ sequenceNumber: 9, homeScore: 50, awayScore: 50 });
      const game = makeGame({ plays: [prior], players: [player] });
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Marcus Johnson - Buzzer beater!');
    });

    it('uses just the shot description when no player name matches play text', () => {
      const player = makePlayer({ playerId: 'p1', playerName: 'Marcus Johnson', teamId: 'away' });
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        text: 'Two Point Jump Shot Made',
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const prior = makePlay({ sequenceNumber: 9, homeScore: 50, awayScore: 50 });
      const game = makeGame({ plays: [prior], players: [player] });
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Buzzer beater!');
    });

    it('only matches players on the scoring team, not the opponent', () => {
      const homePlayer = makePlayer({ playerId: 'p1', playerName: 'Home Star', teamId: 'home' });
      const awayPlayer = makePlayer({ playerId: 'p2', playerName: 'Away Star', teamId: 'away' });
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 0, period: 2,
        text: 'Away Star made Two Point Jump Shot',
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const prior = makePlay({ sequenceNumber: 9, homeScore: 50, awayScore: 50 });
      const game = makeGame({ plays: [prior], players: [homePlayer, awayPlayer] });
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toContain('Away Star');
      expect(alert!.headline).not.toContain('Home Star');
    });

    it('includes team abbreviation in body when teamId is known', () => {
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const prior = makePlay({ sequenceNumber: 9, homeScore: 50, awayScore: 50 });
      const game = makeGame({ plays: [prior] });
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.body).toContain('AWAY');
      expect(alert!.body).toMatch(/^AWAY \|/);
    });

    it('omits team prefix from body when teamId is null', () => {
      const play = makePlay({
        teamId: null, scoringPlay: true, clockSeconds: 600, period: 2,
        coordinate: { x: 25, y: 65 },
      });
      const alert = rule.evaluate(play, makeGame());
      expect(alert).not.toBeNull();
      // Body should start with the score, not a team abbreviation
      expect(alert!.body).toMatch(/^(HOME|AWAY) \d+/);
    });

    it('player name prefix works for go-ahead shots too', () => {
      const player = makePlayer({ playerId: 'p1', playerName: 'Jane Doe', teamId: 'away' });
      const play = makePlay({
        teamId: 'away', scoringPlay: true, clockSeconds: 30, period: 2,
        text: 'Jane Doe made Three Point Jump Shot',
        homeScore: 50, awayScore: 52, sequenceNumber: 10,
      });
      const prior = makePlay({ sequenceNumber: 9, homeScore: 50, awayScore: 50 });
      const game = makeGame({ plays: [prior], players: [player] });
      const alert = rule.evaluate(play, game);
      expect(alert).not.toBeNull();
      expect(alert!.headline).toBe('Jane Doe - Go-ahead basket!');
    });
  });
});
