import { describe, it, expect } from 'vitest';
import { UpsetBrewingRule } from '../../src/rules/upset-brewing.js';
import { makeGame, makeTeam } from './helpers.js';

const rule = new UpsetBrewingRule();

describe('UpsetBrewingRule', () => {
  const highSeed = makeTeam({ id: 'high', seed: 1, score: 55 });
  const lowSeed = makeTeam({ id: 'low', seed: 12, score: 60 });

  it('fires when underdog leads in 2nd half', () => {
    const game = makeGame({ period: 2, status: 'in',
      homeTeam: lowSeed, awayTeam: highSeed });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('upset-brewing:game1');
  });

  it('does not fire for a finished game', () => {
    const game = makeGame({ status: 'post',
      homeTeam: lowSeed, awayTeam: highSeed });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires for a 1-seed difference (e.g. #8 leads #7)', () => {
    const game = makeGame({
      homeTeam: makeTeam({ id: 'home', seed: 8, score: 60 }),
      awayTeam: makeTeam({ id: 'away', seed: 7, score: 55 }),
      period: 2, status: 'in',
    });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire if seeds are equal', () => {
    const game = makeGame({
      homeTeam: makeTeam({ id: 'home', seed: 5, score: 60 }),
      awayTeam: makeTeam({ id: 'away', seed: 5, score: 55 }),
      period: 2, status: 'in',
    });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire if favorite is leading', () => {
    const game = makeGame({ period: 2, status: 'in',
      homeTeam: makeTeam({ id: 'high', seed: 1, score: 70 }),
      awayTeam: makeTeam({ id: 'low', seed: 12, score: 60 }) });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when no seeds present', () => {
    const game = makeGame({ period: 2, status: 'in' });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire in 1st half', () => {
    const game = makeGame({ period: 1, status: 'in',
      homeTeam: lowSeed, awayTeam: highSeed });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires early 2nd half when win prob >= 50%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 900,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.60 });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire in 1st half even with win prob >= 50%', () => {
    const game = makeGame({ period: 1, status: 'in', clockSeconds: 900,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.65 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires at exactly 1200s boundary with win prob >= 50%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 1200,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.50 });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire at 1201s with win prob >= 50%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 1201,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.55 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires last 10 min with win prob 35-50%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 300,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.40 });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire early 2nd half with win prob 35-50%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 900,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.40 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('fires at exactly 35% boundary in last 10 min', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 300,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.35 });
    expect(rule.evaluate(game)).toHaveLength(1);
  });

  it('does not fire when win prob < 35%', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 60,
      homeTeam: lowSeed, awayTeam: highSeed, homeWinPct: 0.20 });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire early 2nd half when win prob is undefined', () => {
    const game = makeGame({ period: 2, status: 'in', clockSeconds: 900,
      homeTeam: lowSeed, awayTeam: highSeed });
    expect(rule.evaluate(game)).toHaveLength(0);
  });
});
