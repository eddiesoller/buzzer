import { Alert } from '../types/alert.js';

const MAX_TWEET_LENGTH = 280;

const HASHTAG = process.env.BUZZER_HASHTAG ?? '#MarchMadness';

const PRIORITY_PREFIX: Record<Alert['priority'], string> = {
  high: '🚨',
  medium: '🏀',
  low: 'ℹ️',
};

const RULE_PREFIX: Partial<Record<string, string>> = {
  'goose-egg':    '🦆',
  'scoring-run':  '🔥',
  'five-by-five': '🌟',
};

/**
 * Formats an alert into a tweet ≤ 280 characters.
 * Tries headline + body first; drops body if needed (body content is always
 * present in the headline context so truncation is safe).
 */
export function formatTweet(alert: Alert): string {
  const prefix = RULE_PREFIX[alert.rule] ?? PRIORITY_PREFIX[alert.priority];

  const headline = `${prefix} ${alert.headline}`;
  const full = `${headline}\n\n${alert.body}\n\n${HASHTAG}`;

  if (full.length <= MAX_TWEET_LENGTH) return full;

  const withoutBody = `${headline}\n\n${HASHTAG}`;
  if (withoutBody.length <= MAX_TWEET_LENGTH) return withoutBody;

  // Truncate headline if necessary
  const suffix = `…\n\n${HASHTAG}`;
  const maxHeadline = MAX_TWEET_LENGTH - suffix.length;
  return `${headline.slice(0, maxHeadline)}${suffix}`;
}
