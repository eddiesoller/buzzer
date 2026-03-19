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
import { EspnSummaryResponse, EspnScoreboardResponse } from '../../src/types/espn.js';

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

  it('fires play-level rules in the terminal poll when game status is post', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    // pollScoreboard already flipped status to 'post'; cursor was at seq 100
    const game = makeGame({ id: 'g1', status: 'post', lastProcessedSeq: 100 });
    runner['gameCache'].set('g1', game);

    vi.spyOn(EspnClient.prototype, 'fetchGameSummary').mockResolvedValue({
      boxscore: { teams: [], players: [] },
      plays: [
        // Seq 100: already processed, tied at 50-50
        { id: '1', sequenceNumber: '100', scoringPlay: false,
          homeScore: 50, awayScore: 50,
          period: { number: 2, displayValue: '2nd Half' },
          clock: { displayValue: '0:35' },
          team: { id: 'home' }, text: 'Foul' },
        // Seq 101: new go-ahead — home takes lead with 30 seconds left
        { id: '2', sequenceNumber: '101', scoringPlay: true,
          homeScore: 52, awayScore: 50,
          period: { number: 2, displayValue: '2nd Half' },
          clock: { displayValue: '0:30' },
          team: { id: 'home' }, text: 'Jump shot' },
      ],
    });

    await runner.pollGame('g1');

    const evaluated = store.filterNewAlerts.mock.calls.flatMap((c) => c[0] as { rule: string }[]);
    expect(evaluated.some((a) => a.rule === 'big-shot')).toBe(true);
  });

  it('always emits "Alerts evaluated" even when no alerts fire', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    const game = makeGame({ id: 'g1', lastProcessedSeq: 100 });
    runner['gameCache'].set('g1', game);

    vi.spyOn(EspnClient.prototype, 'fetchGameSummary').mockResolvedValue({
      boxscore: { teams: [], players: [] },
      plays: [],
    });

    const loggedMessages: string[] = [];
    vi.spyOn(runner['logger'], 'info').mockImplementation((...args: unknown[]) => {
      const msg = args.find((a) => typeof a === 'string');
      if (msg) loggedMessages.push(msg);
    });

    await runner.pollGame('g1');

    expect(loggedMessages).toContain('Alerts evaluated');
    // filterNewAlerts should NOT be called when there are no alerts
    expect(store.filterNewAlerts).not.toHaveBeenCalled();
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

function makeScoreboardWith(ids: string[]): EspnScoreboardResponse {
  const makeCompetitor = (homeAway: 'home' | 'away', teamId: string) => ({
    id: teamId,
    homeAway,
    score: '0',
    team: {
      id: teamId,
      displayName: `Team ${teamId}`,
      shortDisplayName: `T${teamId}`,
      abbreviation: `T${teamId}`,
    },
  });

  return {
    events: ids.map((id) => ({
      id,
      date: '2026-03-19T00:00:00Z',
      name: `Game ${id}`,
      shortName: `G${id}`,
      status: {
        clock: 600,
        displayClock: '10:00',
        period: 1,
        type: {
          id: '2',
          name: 'STATUS_IN_PROGRESS',
          state: 'in',
          completed: false,
          description: 'In Progress',
          detail: '10:00 - 1st Half',
          shortDetail: '10:00 - 1st',
        },
      },
      competitions: [
        {
          id,
          date: '2026-03-19T00:00:00Z',
          competitors: [makeCompetitor('home', `h${id}`), makeCompetitor('away', `a${id}`)],
          status: {
            clock: 600,
            displayClock: '10:00',
            period: 1,
            type: {
              id: '2',
              name: 'STATUS_IN_PROGRESS',
              state: 'in',
              completed: false,
              description: 'In Progress',
              detail: '10:00 - 1st Half',
              shortDetail: '10:00 - 1st',
            },
          },
        },
      ],
    })),
  };
}

describe('Runner pollScoreboard', () => {
  it('starts a watcher for each live game and polls all of them', async () => {
    const store = makeStore();
    const runner = makeRunner(store);

    const gameIds = ['game1', 'game2', 'game3'];

    vi.spyOn(EspnClient.prototype, 'fetchScoreboard').mockResolvedValue(
      makeScoreboardWith(gameIds)
    );

    const pollGameSpy = vi.spyOn(runner as never, 'pollGame').mockResolvedValue(undefined);

    await runner.pollScoreboard();

    expect(runner['watchers'].size).toBe(3);
    const polledIds = pollGameSpy.mock.calls.map((c) => c[0]);
    for (const id of gameIds) {
      expect(polledIds).toContain(id);
    }

    runner.shutdown();
  });
});
