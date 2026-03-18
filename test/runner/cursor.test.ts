/**
 * Tests for the play cursor logic in Runner.pollGame().
 *
 * The cursor (lastProcessedSeq) ensures play-level rules only fire for plays
 * that occurred after the service started watching a game. This prevents
 * retroactive alerts when the service restarts mid-game.
 */
import { vi, describe, it, expect, afterEach } from 'vitest';
import pino from 'pino';
import { Runner } from '../../src/runner.js';
import { EspnClient } from '../../src/espn/client.js';
import { makeGame } from '../rules/helpers.js';
import { EspnSummaryResponse } from '../../src/types/espn.js';

function makeStore() {
  return {
    loadGame: vi.fn().mockResolvedValue(null),
    saveGame: vi.fn().mockResolvedValue(undefined),
    filterNewAlerts: vi.fn().mockResolvedValue([]),
    markAlertFired: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRunner(store: ReturnType<typeof makeStore>) {
  const logger = pino({ level: 'silent' });
  return new Runner(store as never, [], logger, true /* dryRun */, 30);
}

/** A summary with one buzzer-beater long-range play (would fire BigShotRule if processed). */
function makeSummaryWithBigShot(sequenceNumber: string): EspnSummaryResponse {
  return {
    boxscore: { teams: [], players: [] },
    plays: [
      {
        id: '1',
        sequenceNumber,
        scoringPlay: true,
        homeScore: 3,
        awayScore: 0,
        period: { number: 2, displayValue: '2nd Half' },
        clock: { displayValue: '0:01' }, // buzzer
        team: { id: 'home' },
        text: '65-foot buzzer beater',
        coordinate: { x: 25, y: 65 }, // long-range
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Runner play cursor', () => {
  it('skips retroactive plays on the first poll for a new game', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    // Seed cache with a game that has no prior cursor (first time seen)
    const game = makeGame({ id: 'g1' });
    runner['gameCache'].set('g1', game);

    vi.spyOn(EspnClient.prototype, 'fetchGameSummary').mockResolvedValue(
      makeSummaryWithBigShot('100')
    );

    await runner.pollGame('g1');

    // Cursor should be advanced to 100 so future polls start from here
    const saved: { lastProcessedSeq?: number } = store.saveGame.mock.calls[0]?.[0];
    expect(saved.lastProcessedSeq).toBe(100);

    // No play-level alerts should have been evaluated
    const evaluated = store.filterNewAlerts.mock.calls.flatMap((c) => c[0] as { rule: string }[]);
    expect(evaluated.some((a) => a.rule === 'big-shot')).toBe(false);
  });

  it('processes only new plays on subsequent polls', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    // Seed cache with cursor already at 100 (previous poll)
    const game = makeGame({ id: 'g1', lastProcessedSeq: 100 });
    runner['gameCache'].set('g1', game);

    vi.spyOn(EspnClient.prototype, 'fetchGameSummary').mockResolvedValue({
      boxscore: { teams: [], players: [] },
      plays: [
        // Already processed — should be ignored
        { id: '1', sequenceNumber: '100', scoringPlay: false, homeScore: 0, awayScore: 0,
          period: { number: 2, displayValue: '2nd Half' }, clock: { displayValue: '5:00' },
          team: { id: 'home' }, text: 'Turnover' },
        // New play — should trigger BigShotRule
        { id: '2', sequenceNumber: '101', scoringPlay: true, homeScore: 3, awayScore: 0,
          period: { number: 2, displayValue: '2nd Half' }, clock: { displayValue: '0:01' },
          team: { id: 'home' }, text: '65-foot buzzer beater', coordinate: { x: 25, y: 65 } },
      ],
    });

    await runner.pollGame('g1');

    const evaluated = store.filterNewAlerts.mock.calls.flatMap((c) => c[0] as { rule: string }[]);
    expect(evaluated.some((a) => a.rule === 'big-shot')).toBe(true);

    const saved: { lastProcessedSeq?: number } = store.saveGame.mock.calls[0]?.[0];
    expect(saved.lastProcessedSeq).toBe(101);
  });

  it('resets cursor and reprocesses all plays on sequence regression', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    // Cursor was at 200 but ESPN regressed to 50
    const game = makeGame({ id: 'g1', lastProcessedSeq: 200 });
    runner['gameCache'].set('g1', game);

    vi.spyOn(EspnClient.prototype, 'fetchGameSummary').mockResolvedValue(
      makeSummaryWithBigShot('50')
    );

    await runner.pollGame('g1');

    // Cursor should reset to the new max
    const saved: { lastProcessedSeq?: number } = store.saveGame.mock.calls[0]?.[0];
    expect(saved.lastProcessedSeq).toBe(50);

    // All plays reprocessed (BigShotRule fires — dedup handles double-post prevention)
    const evaluated = store.filterNewAlerts.mock.calls.flatMap((c) => c[0] as { rule: string }[]);
    expect(evaluated.some((a) => a.rule === 'big-shot')).toBe(true);
  });
});
