import { describe, it, expect } from 'vitest';
import { GameFinalRule } from '../../src/rules/game-final.js';
import { makeGame, makePlay, makeTeam } from './helpers.js';

const rule = new GameFinalRule();

// margin=10: not close (>5), not blowout (<30) → normal win
const home = makeTeam({ id: 'home', score: 75 });
const away = makeTeam({ id: 'away', score: 65 });

// margin=3: close regulation win
const closeHome = makeTeam({ id: 'home', score: 75 });
const closeAway = makeTeam({ id: 'away', score: 72 });

describe('GameFinalRule', () => {
  it('does not fire for a live game', () => {
    const game = makeGame({ status: 'in', homeTeam: home, awayTeam: away });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire for a pre-game', () => {
    const game = makeGame({ status: 'pre', period: 0 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires one alert for a normal regulation win', () => {
    const game = makeGame({ status: 'post', period: 2, homeTeam: home, awayTeam: away });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('game-final:game1');
    expect(alerts[0]!.rule).toBe('game-final');
    expect(alerts[0]!.body).toBe('Final: AWAY 65, HOME 75');
    expect(alerts[0]!.priority).toBe('low');
  });

  it('alert ID is always game-final:gameId', () => {
    const game = makeGame({ status: 'post', period: 2, homeTeam: home, awayTeam: away });
    expect(rule.evaluate(game)[0]!.id).toBe('game-final:game1');
  });

  describe('OT win', () => {
    it('uses OT label in headline and sets high priority', () => {
      const game = makeGame({ status: 'post', period: 3, homeTeam: home, awayTeam: away });
      const alerts = rule.evaluate(game);
      expect(alerts[0]!.headline).toContain('OT');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('uses 2OT label for double overtime', () => {
      const game = makeGame({ status: 'post', period: 4, homeTeam: home, awayTeam: away });
      expect(rule.evaluate(game)[0]!.headline).toContain('2OT');
    });
  });

  describe('blowout', () => {
    it('uses a blowout verb and includes margin when margin >= 30', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: makeTeam({ id: 'home', score: 95 }),
        awayTeam: makeTeam({ id: 'away', score: 60 }) });
      const headline = rule.evaluate(game)[0]!.headline;
      expect(headline).toContain('35');
      expect(headline).toMatch(/demolishes|blows out|crushes|throttles|routs/);
    });

    it('sets medium priority', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: makeTeam({ id: 'home', score: 95 }),
        awayTeam: makeTeam({ id: 'away', score: 60 }) });
      expect(rule.evaluate(game)[0]!.priority).toBe('medium');
    });
  });

  describe('close regulation win', () => {
    it('uses a close-win verb in headline when margin <= 5', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: closeHome, awayTeam: closeAway });
      const headline = rule.evaluate(game)[0]!.headline;
      expect(headline).toMatch(/edges|squeaks past|holds off|escapes past|outlasts/);
    });

    it('sets medium priority', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: closeHome, awayTeam: closeAway });
      expect(rule.evaluate(game)[0]!.priority).toBe('medium');
    });

    it('does not use close-win verb for OT wins (OT takes priority)', () => {
      const game = makeGame({ status: 'post', period: 3,
        homeTeam: closeHome, awayTeam: closeAway });
      const headline = rule.evaluate(game)[0]!.headline;
      expect(headline).not.toMatch(/edges|squeaks past|holds off|escapes past/);
    });
  });

  describe('upset', () => {
    it('uses UPSET: prefix and sets high priority', () => {
      const favTeam = makeTeam({ id: 'away', seed: 1, score: 70 });
      const underdogTeam = makeTeam({ id: 'home', seed: 12, score: 75 });
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: underdogTeam, awayTeam: favTeam });
      const alerts = rule.evaluate(game);
      expect(alerts[0]!.headline).toMatch(/^UPSET:/);
      expect(alerts[0]!.headline).toContain('#12');
      expect(alerts[0]!.headline).toContain('#1');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('includes OT label when upset happens in OT', () => {
      const favTeam = makeTeam({ id: 'away', seed: 1, score: 70 });
      const underdogTeam = makeTeam({ id: 'home', seed: 12, score: 75 });
      const game = makeGame({ status: 'post', period: 3,
        homeTeam: underdogTeam, awayTeam: favTeam });
      expect(rule.evaluate(game)[0]!.headline).toContain('OT');
    });
  });

  describe('buzzer beater', () => {
    const winningPlay = makePlay({
      teamId: 'home',
      homeScore: 75,
      awayScore: 65,
      scoringPlay: true,
      period: 2,
      clockSeconds: 0,
      sequenceNumber: 100,
      text: 'Three Point Jumper',
    });

    it('uses buzzer beater phrasing and sets high priority', () => {
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: home, awayTeam: away, plays: [winningPlay] });
      const alerts = rule.evaluate(game);
      expect(alerts[0]!.headline).toContain('buzzer beater');
      expect(alerts[0]!.priority).toBe('high');
    });

    it('includes distance in headline when coordinate is present', () => {
      const longPlay = { ...winningPlay, coordinate: { x: 25, y: 42 } };
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: home, awayTeam: away, plays: [longPlay] });
      expect(rule.evaluate(game)[0]!.headline).toContain('42-foot');
    });

    it('does not flag a free throw as a buzzer beater', () => {
      const ftPlay = { ...winningPlay, text: 'Free Throw' };
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: home, awayTeam: away, plays: [ftPlay] });
      expect(rule.evaluate(game)[0]!.headline).not.toContain('buzzer beater');
    });

    it('does not flag a clock-0 play by the losing team', () => {
      const losingPlay = { ...winningPlay, teamId: 'away' };
      const game = makeGame({ status: 'post', period: 2,
        homeTeam: home, awayTeam: away, plays: [losingPlay] });
      expect(rule.evaluate(game)[0]!.headline).not.toContain('buzzer beater');
    });
  });
});
