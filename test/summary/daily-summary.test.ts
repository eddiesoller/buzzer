import { describe, it, expect } from 'vitest';
import { buildSummaryThread } from '../../src/summary/daily-summary.js';
import { makeGame, makeAlert } from '../rules/helpers.js';
import { Alert } from '../../src/types/alert.js';
import { Game } from '../../src/types/game.js';

function makeFinalAlert(gameId: string, headline: string, priority: Alert['priority'] = 'medium'): Alert {
  return makeAlert({ id: `game-final:${gameId}`, rule: 'game-final', gameId, headline, priority });
}

function makeHighlight(gameId: string, id: string, priority: Alert['priority']): Alert {
  return makeAlert({ id, rule: 'scoring-run', gameId, headline: `Highlight ${id}`, priority });
}

function gameAlertMap(entries: [string, Alert[]][]): Map<string, Alert[]> {
  return new Map(entries);
}

describe('buildSummaryThread', () => {
  describe('header tweet', () => {
    it('includes game count', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!', 'low')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).toContain('1 game');
      expect(header).toContain('#MarchMadness');
    });

    it('pluralises game count correctly', () => {
      const g1 = makeGame({ id: 'g1', status: 'post', period: 2 });
      const g2 = makeGame({ id: 'g2', status: 'post', period: 2 });
      const alerts = gameAlertMap([
        ['g1', [makeFinalAlert('g1', 'Duke wins!')]],
        ['g2', [makeFinalAlert('g2', 'UNC wins!')]],
      ]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [g1, g2]);
      expect(header).toContain('2 games');
    });

    it('includes upset count when upsets occurred', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'UPSET: #12 Duke defeats #1 UNC!', 'high')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).toContain('1 upset');
    });

    it('omits upset count when no upsets', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).not.toContain('upset');
    });

    it('includes OT count when OT games occurred', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 3 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins in OT!', 'high')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).toContain('1 OT game');
    });

    it('omits OT count when no OT games', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).not.toContain('OT');
    });

    it('formats the date label', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!')]]]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(header).toContain('Mar 19');
    });

    it('includes all three stats when all are non-zero', () => {
      const g1 = makeGame({ id: 'g1', status: 'post', period: 3 });
      const g2 = makeGame({ id: 'g2', status: 'post', period: 2 });
      const alerts = gameAlertMap([
        ['g1', [makeFinalAlert('g1', 'UPSET: #12 Duke defeats #1 UNC!', 'high')]],
        ['g2', [makeFinalAlert('g2', 'UNC wins!')]],
      ]);
      const [header] = buildSummaryThread('2026-03-19', alerts, [g1, g2]);
      expect(header).toContain('2 games');
      expect(header).toContain('1 upset');
      expect(header).toContain('1 OT game');
    });
  });

  describe('per-game tweets', () => {
    it('produces one tweet per game with a game-final alert', () => {
      const g1 = makeGame({ id: 'g1', status: 'post', period: 2 });
      const g2 = makeGame({ id: 'g2', status: 'post', period: 2 });
      const alerts = gameAlertMap([
        ['g1', [makeFinalAlert('g1', 'Duke wins!')]],
        ['g2', [makeFinalAlert('g2', 'UNC wins!')]],
      ]);
      const tweets = buildSummaryThread('2026-03-19', alerts, [g1, g2]);
      expect(tweets).toHaveLength(3); // header + 2 games
    });

    it('skips games with no game-final alert', () => {
      const g1 = makeGame({ id: 'g1', status: 'post', period: 2 });
      const g2 = makeGame({ id: 'g2', status: 'post', period: 2 });
      const alerts = gameAlertMap([
        ['g1', [makeFinalAlert('g1', 'Duke wins!')]],
        ['g2', [makeHighlight('g2', 'h1', 'medium')]], // no game-final
      ]);
      const tweets = buildSummaryThread('2026-03-19', alerts, [g1, g2]);
      expect(tweets).toHaveLength(2); // header + only g1
    });

    it('includes the game-final headline in the game tweet', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke upsets UNC!', 'high')]]]);
      const [, gameTweet] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(gameTweet).toContain('Duke upsets UNC!');
    });

    it('includes team hashtags', () => {
      const game = makeGame({
        id: 'g1',
        status: 'post',
        period: 2,
        homeTeam: { id: 'h', name: 'Duke Blue Devils', shortName: 'Duke', abbreviation: 'DUKE', score: 80 },
        awayTeam: { id: 'a', name: 'UNC Tar Heels', shortName: 'UNC', abbreviation: 'UNC', score: 75 },
      });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!')]]]);
      const [, gameTweet] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(gameTweet).toContain('#GoDuke');
      expect(gameTweet).toContain('#GoHeels');
      expect(gameTweet).toContain('#MarchMadness');
    });

    it('includes highlights sorted high → medium → low', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [
        makeFinalAlert('g1', 'Duke wins!'),
        makeHighlight('g1', 'low:g1', 'low'),
        makeHighlight('g1', 'high:g1', 'high'),
        makeHighlight('g1', 'med:g1', 'medium'),
      ]]]);
      const [, gameTweet] = buildSummaryThread('2026-03-19', alerts, [game]);
      const highPos = gameTweet.indexOf('Highlight high:g1');
      const medPos = gameTweet.indexOf('Highlight med:g1');
      const lowPos = gameTweet.indexOf('Highlight low:g1');
      expect(highPos).toBeLessThan(medPos);
      expect(medPos).toBeLessThan(lowPos);
    });

    it('caps highlights at 3', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const highlights = Array.from({ length: 5 }, (_, i) =>
        makeHighlight('g1', `h${i}`, 'low')
      );
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!'), ...highlights]]]);
      const [, gameTweet] = buildSummaryThread('2026-03-19', alerts, [game]);
      const matchCount = (gameTweet.match(/Highlight h/g) ?? []).length;
      expect(matchCount).toBeLessThanOrEqual(3);
    });

    it('keeps all tweets ≤ 280 characters', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const longHeadline = 'A'.repeat(300);
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', longHeadline, 'high')]]]);
      const tweets = buildSummaryThread('2026-03-19', alerts, [game]);
      for (const tweet of tweets) {
        expect(tweet.length).toBeLessThanOrEqual(280);
      }
    });

    it('drops highlights when tweet would exceed 280 chars', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const longHighlight = makeAlert({
        id: 'h:g1',
        rule: 'scoring-run',
        gameId: 'g1',
        headline: 'B'.repeat(200),
        priority: 'high',
      });
      const alerts = gameAlertMap([['g1', [makeFinalAlert('g1', 'Duke wins!'), longHighlight]]]);
      const [, gameTweet] = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(gameTweet.length).toBeLessThanOrEqual(280);
      expect(gameTweet).toContain('Duke wins!');
    });

    it('returns only the header when no games have game-final alerts', () => {
      const game = makeGame({ id: 'g1', status: 'post', period: 2 });
      const alerts = gameAlertMap([['g1', [makeHighlight('g1', 'h1', 'medium')]]]);
      const tweets = buildSummaryThread('2026-03-19', alerts, [game]);
      expect(tweets).toHaveLength(1);
    });

    it('handles empty game list', () => {
      const tweets = buildSummaryThread('2026-03-19', new Map(), []);
      expect(tweets).toHaveLength(1); // just the header
      expect(tweets[0]).toContain('0 games');
    });
  });
});
