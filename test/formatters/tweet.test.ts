import { describe, it, expect } from 'vitest';
import { formatTweet } from '../../src/formatters/tweet.js';
import { makeAlert } from '../rules/helpers.js';

describe('formatTweet', () => {
  it('produces a tweet ≤ 280 characters', () => {
    const tweet = formatTweet(makeAlert({ id: 'test:game1' }));
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it('includes the headline', () => {
    const tweet = formatTweet(makeAlert({ id: 'test:game1', headline: 'Close game alert!' }));
    expect(tweet).toContain('Close game alert!');
  });

  it('includes #MarchMadness hashtag', () => {
    expect(formatTweet(makeAlert({ id: 'test:game1' }))).toContain('#MarchMadness');
  });

  it('truncates long content to stay within 280 chars', () => {
    const tweet = formatTweet(makeAlert({ id: 'test:game1', headline: 'A'.repeat(300) }));
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it('uses correct emoji for priority', () => {
    expect(formatTweet(makeAlert({ id: 'test:game1', priority: 'high' }))).toContain('🚨');
    expect(formatTweet(makeAlert({ id: 'test:game1', priority: 'medium' }))).toContain('🏀');
    expect(formatTweet(makeAlert({ id: 'test:game1', priority: 'low' }))).toContain('ℹ️');
  });
});
