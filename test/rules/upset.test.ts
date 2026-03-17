import { describe, it, expect } from 'vitest';
import { UpsetRule } from '../../src/rules/upset.js';
import { makeGame, makeTeam } from './helpers.js';

const rule = new UpsetRule();

describe('UpsetRule', () => {
  const highSeed = makeTeam({ id: 'high', seed: 1, score: 55 });
  const lowSeed = makeTeam({ id: 'low', seed: 12, score: 60 });

  it('fires upset-brewing when underdog leads in 2nd half', () => {
    const game = makeGame({ period: 2, status: 'in',
      homeTeam: lowSeed, awayTeam: highSeed });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id.startsWith('upset-brewing'))).toBe(true);
  });

  it('fires upset-confirmed when underdog wins', () => {
    const game = makeGame({ status: 'post',
      homeTeam: lowSeed, awayTeam: highSeed });
    const alerts = rule.evaluate(game);
    expect(alerts.some((a) => a.id.startsWith('upset-confirmed'))).toBe(true);
  });

  it('fires for a 1-seed difference (e.g. #8 leads #7)', () => {
    const game = makeGame({
      homeTeam: makeTeam({ id: 'home', seed: 8, score: 60 }),
      awayTeam: makeTeam({ id: 'away', seed: 7, score: 55 }),
      period: 2, status: 'in',
    });
    expect(rule.evaluate(game).some((a) => a.id.startsWith('upset-brewing'))).toBe(true);
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
});
