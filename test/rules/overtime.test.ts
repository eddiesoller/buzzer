import { describe, it, expect } from 'vitest';
import { OvertimeRule } from '../../src/rules/overtime.js';
import { makeGame } from './helpers.js';

const rule = new OvertimeRule();

describe('OvertimeRule', () => {
  it('fires when a live game enters OT', () => {
    const game = makeGame({ period: 3, clockSeconds: 300 });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('overtime:game1:3');
    expect(alerts[0]!.headline).toContain('OT');
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires for double OT with distinct id', () => {
    const game = makeGame({ period: 4, clockSeconds: 300 });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('overtime:game1:4');
    expect(alerts[0]!.headline).toContain('2OT');
  });

  it('fires for triple OT', () => {
    const game = makeGame({ period: 5, clockSeconds: 300 });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.headline).toContain('3OT');
  });

  it('each OT period has a unique id so all can fire', () => {
    const ot1 = makeGame({ period: 3, clockSeconds: 300 });
    const ot2 = makeGame({ period: 4, clockSeconds: 300 });
    expect(rule.evaluate(ot1)[0]!.id).not.toBe(rule.evaluate(ot2)[0]!.id);
  });

  it('does not fire for a finished game', () => {
    const game = makeGame({ status: 'post', period: 3,
      homeTeam: { ...makeGame().homeTeam, score: 72 },
      awayTeam: { ...makeGame().awayTeam, score: 70 } });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire in regulation', () => {
    expect(rule.evaluate(makeGame({ period: 2 }))).toHaveLength(0);
    expect(rule.evaluate(makeGame({ period: 1 }))).toHaveLength(0);
  });

  it('does not fire for pre-game', () => {
    expect(rule.evaluate(makeGame({ status: 'pre', period: 0 }))).toHaveLength(0);
  });

  it('fires at end of tied regulation (period 2, clock 0, tied)', () => {
    const game = makeGame({
      period: 2,
      clockSeconds: 0,
      homeTeam: { ...makeGame().homeTeam, score: 60 },
      awayTeam: { ...makeGame().awayTeam, score: 60 },
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('overtime:game1:3');
    expect(alerts[0]!.headline).toContain('OT');
  });

  it('does not fire at end of regulation when not tied', () => {
    const game = makeGame({
      period: 2,
      clockSeconds: 0,
      homeTeam: { ...makeGame().homeTeam, score: 62 },
      awayTeam: { ...makeGame().awayTeam, score: 60 },
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires at end of tied OT1 (period 3, clock 0, tied)', () => {
    const game = makeGame({
      period: 3,
      clockSeconds: 0,
      homeTeam: { ...makeGame().homeTeam, score: 65 },
      awayTeam: { ...makeGame().awayTeam, score: 65 },
    });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('overtime:game1:4');
    expect(alerts[0]!.headline).toContain('2OT');
  });
});
