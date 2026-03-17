import { describe, it, expect } from 'vitest';
import { GooseEggRule } from '../../src/rules/goose-egg.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new GooseEggRule();

describe('GooseEggRule', () => {
  it('fires when player has 20+ minutes and 0 pts/reb/ast in a finished game', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 22, points: 0, rebounds: 0, assists: 0 });
    const game = makeGame({ status: 'post', players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain('goose-egg');
    expect(alerts[0]!.priority).toBe('low');
  });

  it('does not fire for live games', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 22, points: 0, rebounds: 0, assists: 0 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when player has < 20 minutes', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 19, points: 0, rebounds: 0, assists: 0 });
    const game = makeGame({ status: 'post', players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when player has points', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 25, points: 2, rebounds: 0, assists: 0 });
    const game = makeGame({ status: 'post', players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when player has rebounds', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 25, points: 0, rebounds: 1, assists: 0 });
    const game = makeGame({ status: 'post', players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire when player has assists', () => {
    const player = makePlayer({ playerId: 'p1', minutesPlayed: 25, points: 0, rebounds: 0, assists: 1 });
    const game = makeGame({ status: 'post', players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire without players', () => {
    const game = makeGame({ status: 'post' });
    expect(rule.evaluate(game)).toHaveLength(0);
  });
});
