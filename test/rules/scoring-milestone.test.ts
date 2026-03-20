import { describe, it, expect } from 'vitest';
import { ScoringMilestoneRule } from '../../src/rules/scoring-milestone.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new ScoringMilestoneRule();

describe('ScoringMilestoneRule', () => {
  it('fires at 30 points', () => {
    const player = makePlayer({ playerId: 'p1', points: 30 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain(':30');
    expect(alerts[0]!.priority).toBe('medium');
  });

  it('fires at 40 points with high priority', () => {
    const player = makePlayer({ playerId: 'p1', points: 42 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain(':40');
    expect(alerts[0]!.priority).toBe('high');
  });

  it('fires at 50 points', () => {
    const player = makePlayer({ playerId: 'p1', points: 51 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain(':50');
  });

  it('fires at 60+ points', () => {
    const player = makePlayer({ playerId: 'p1', points: 63 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toContain(':60');
  });

  it('fires exactly one alert per player at the highest achieved milestone', () => {
    const player = makePlayer({ playerId: 'p1', points: 42 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).not.toContain(':30');
  });

  it('body includes score, period, clock, and shooting lines', () => {
    const player = makePlayer({ playerId: 'p1', points: 30, fieldGoalsMade: 12, fieldGoalsAttempted: 20, threePointMade: 3, threePointAttempted: 7, freeThrowsMade: 3, freeThrowsAttempted: 4 });
    const game = makeGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.body).toBe('AWAY 45, HOME 50 | 2nd Half | 10:00 | 2FG: 9/13 | 3FG: 3/7 | FT: 3/4');
  });

  it('does not fire below 30 points', () => {
    const player = makePlayer({ playerId: 'p1', points: 29 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does not fire without players', () => {
    expect(rule.evaluate(makeGame())).toHaveLength(0);
  });

  it('fires for multiple players independently', () => {
    const p1 = makePlayer({ playerId: 'p1', points: 33 });
    const p2 = makePlayer({ playerId: 'p2', points: 41 });
    const game = makeGame({ players: [p1, p2] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(2);
  });
});
