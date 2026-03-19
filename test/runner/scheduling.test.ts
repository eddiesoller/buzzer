/**
 * Tests for Runner.nextScoreboardPollMs — smart scoreboard poll scheduling.
 *
 * When no games are live and the next tip-off is far away, the runner
 * sleeps until 5 minutes before the scheduled start rather than polling
 * on the fixed interval.
 */
import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Runner } from '../../src/runner.js';
import { makeGame } from '../rules/helpers.js';

const CONFIGURED_MS = 2 * 60 * 1000; // 2 min
const BUFFER_MS = 5 * 60 * 1000; // 5 min

function makeRunner() {
  const store = {
    loadGame: () => Promise.resolve(null),
    saveGame: () => Promise.resolve(),
    filterNewAlerts: () => Promise.resolve([]),
    markAlertFired: () => Promise.resolve(),
  };
  const logger = pino({ level: 'silent' });
  return new Runner(store as never, [], logger, true, 30);
}

describe('Runner.nextScoreboardPollMs', () => {
  it('returns configuredIntervalMs when cache is empty', () => {
    const runner = makeRunner();
    expect(runner.nextScoreboardPollMs(CONFIGURED_MS)).toBe(CONFIGURED_MS);
  });

  it('returns configuredIntervalMs when all games are live', () => {
    const runner = makeRunner();
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'in' }));
    runner['gameCache'].set('g2', makeGame({ id: 'g2', status: 'in' }));
    expect(runner.nextScoreboardPollMs(CONFIGURED_MS)).toBe(CONFIGURED_MS);
  });

  it('returns longer delay when pre-game is hours away', () => {
    const runner = makeRunner();
    const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours from now
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'pre', startTime }));

    const result = runner.nextScoreboardPollMs(CONFIGURED_MS);
    // Should sleep until 5 min before start, which is ~175 min from now
    const expectedMs = new Date(startTime).getTime() - BUFFER_MS - Date.now();
    expect(result).toBeGreaterThan(CONFIGURED_MS);
    // Allow 100ms tolerance for test execution time
    expect(result).toBeCloseTo(expectedMs, -3);
  });

  it('returns configuredIntervalMs when pre-game is within the 5-min buffer', () => {
    const runner = makeRunner();
    // Game starts in 3 minutes — already inside the 5-min buffer
    const startTime = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'pre', startTime }));

    expect(runner.nextScoreboardPollMs(CONFIGURED_MS)).toBe(CONFIGURED_MS);
  });

  it('returns configuredIntervalMs when pre-game start has already passed', () => {
    const runner = makeRunner();
    // Game was scheduled 10 minutes ago but still shows 'pre'
    const startTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'pre', startTime }));

    expect(runner.nextScoreboardPollMs(CONFIGURED_MS)).toBe(CONFIGURED_MS);
  });

  it('returns configuredIntervalMs when mix of live and pre games', () => {
    const runner = makeRunner();
    // Live game takes priority — use normal rate to keep detecting events
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'in' }));
    const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    runner['gameCache'].set('g2', makeGame({ id: 'g2', status: 'pre', startTime }));

    expect(runner.nextScoreboardPollMs(CONFIGURED_MS)).toBe(CONFIGURED_MS);
  });

  it('uses the earliest pre-game when multiple are scheduled', () => {
    const runner = makeRunner();
    const soonStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    const laterStart = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours
    runner['gameCache'].set('g1', makeGame({ id: 'g1', status: 'pre', startTime: laterStart }));
    runner['gameCache'].set('g2', makeGame({ id: 'g2', status: 'pre', startTime: soonStart }));

    const result = runner.nextScoreboardPollMs(CONFIGURED_MS);
    const expectedMs = new Date(soonStart).getTime() - BUFFER_MS - Date.now();
    expect(result).toBeGreaterThan(CONFIGURED_MS);
    expect(result).toBeCloseTo(expectedMs, -3);
  });
});
