import { describe, it, expect } from 'vitest';
import { PlayerGameSummaryRule } from '../../src/rules/player-game-summary.js';
import { makeGame, makePlayer } from './helpers.js';

const rule = new PlayerGameSummaryRule();

const finishedGame = (overrides = {}) => makeGame({ status: 'post', clockSeconds: 0, ...overrides });

describe('PlayerGameSummaryRule', () => {
  it('fires for player with 35 pts (medium priority)', () => {
    const player = makePlayer({ playerId: 'p1', points: 35 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('medium');
    expect(alerts[0]!.headline).toBe('Player p1 finishes with 35 points (35pts, 0reb, 0ast)');
  });

  it('fires for player with 40 pts (high priority)', () => {
    const player = makePlayer({ playerId: 'p1', points: 40 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('high');
    expect(alerts[0]!.headline).toBe('Player p1 finishes with 40 points (40pts, 0reb, 0ast)');
  });

  it('fires for double-double player (medium priority)', () => {
    const player = makePlayer({ playerId: 'p1', points: 22, rebounds: 11 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('medium');
    expect(alerts[0]!.headline).toBe('Double-Double final line: Player p1 (22pts/11reb)');
  });

  it('fires for triple-double player (high priority)', () => {
    const player = makePlayer({ playerId: 'p1', points: 22, rebounds: 11, assists: 10 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('high');
    expect(alerts[0]!.headline).toBe('Triple-Double final line: Player p1 (22pts/11reb/10ast)');
  });

  it('fires for five-by-five player (high priority)', () => {
    const player = makePlayer({ playerId: 'p1', points: 20, rebounds: 8, assists: 7, steals: 5, blocks: 5 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.priority).toBe('high');
    expect(alerts[0]!.headline).toBe('5x5 final line: Player p1 (20pts/8reb/7ast/5stl/5blk)');
  });

  it('does NOT fire for live games', () => {
    const player = makePlayer({ playerId: 'p1', points: 35 });
    const game = makeGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does NOT fire for player with 29 pts and no multi-double', () => {
    const player = makePlayer({ playerId: 'p1', points: 29, rebounds: 5, assists: 4 });
    const game = finishedGame({ players: [player] });
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('does NOT fire without players', () => {
    const game = finishedGame();
    expect(rule.evaluate(game)).toHaveLength(0);
  });

  it('generates one alert per qualifying player (two players → two alerts)', () => {
    const p1 = makePlayer({ playerId: 'p1', points: 35 });
    const p2 = makePlayer({ playerId: 'p2', points: 10, rebounds: 10, assists: 10 });
    const game = finishedGame({ players: [p1, p2] });
    const alerts = rule.evaluate(game);
    expect(alerts).toHaveLength(2);
  });

  it('alert ID contains player-game-summary', () => {
    const player = makePlayer({ playerId: 'p1', points: 30 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.id).toContain('player-game-summary');
    expect(alerts[0]!.id).toBe('player-game-summary:game1:p1');
  });

  it('body is formatted with Final, score, and shooting lines', () => {
    const player = makePlayer({
      playerId: 'p1',
      points: 30,
      fieldGoalsMade: 11,
      fieldGoalsAttempted: 20,
      threePointMade: 2,
      threePointAttempted: 5,
      freeThrowsMade: 6,
      freeThrowsAttempted: 8,
    });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.body).toBe('Final | AWAY 45, HOME 50 | 2FG: 9/15 | 3FG: 2/5 | FT: 6/8');
  });

  it('card stat line includes stl/blk only when ≥5', () => {
    const player = makePlayer({ playerId: 'p1', points: 20, rebounds: 8, assists: 7, steals: 5, blocks: 5 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.context.statLine).toBe('20 PTS  8 REB  7 AST  5 STL  5 BLK');
  });

  it('card stat line omits stl/blk when below 5', () => {
    const player = makePlayer({ playerId: 'p1', points: 35, rebounds: 4, assists: 3, steals: 4, blocks: 2 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.context.statLine).toBe('35 PTS  4 REB  3 AST');
  });

  it('double-double with 40+ pts gets high priority', () => {
    const player = makePlayer({ playerId: 'p1', points: 42, rebounds: 10 });
    const game = finishedGame({ players: [player] });
    const alerts = rule.evaluate(game);
    expect(alerts[0]!.priority).toBe('high');
    expect(alerts[0]!.headline).toContain('Double-Double');
  });
});
