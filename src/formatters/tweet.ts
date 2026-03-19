import { Alert } from '../types/alert.js';
import { Game, Team } from '../types/game.js';
import { TEAM_HASHTAGS } from './team-hashtags.js';

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

function teamHashtag(team: Team): string {
  if (TEAM_HASHTAGS[team.abbreviation]) return TEAM_HASHTAGS[team.abbreviation];
  const derived = team.shortName.replace(/[^a-zA-Z0-9]/g, '');
  return `#${derived}`;
}

/**
 * Formats an alert into a tweet ≤ 280 characters.
 * Truncation cascade: full → drop body → drop body+team tags → truncate headline.
 */
export function formatTweet(alert: Alert, game?: Game): string {
  const prefix = RULE_PREFIX[alert.rule] ?? PRIORITY_PREFIX[alert.priority];
  const headline = `${prefix} ${alert.headline}`;
  const teamTags = game
    ? `${teamHashtag(game.awayTeam)} ${teamHashtag(game.homeTeam)} `
    : '';

  // Step 1: headline + body + team tags + global tag
  const full = `${headline}\n\n${alert.body}\n\n${teamTags}${HASHTAG}`;
  if (full.length <= MAX_TWEET_LENGTH) return full;

  // Step 2: drop body, keep team tags + global tag
  const noBody = `${headline}\n\n${teamTags}${HASHTAG}`;
  if (noBody.length <= MAX_TWEET_LENGTH) return noBody;

  // Step 3: drop body + team tags, keep only global tag
  const noBodyNoTeam = `${headline}\n\n${HASHTAG}`;
  if (noBodyNoTeam.length <= MAX_TWEET_LENGTH) return noBodyNoTeam;

  // Step 4: truncate headline + global tag only
  const suffix = `…\n\n${HASHTAG}`;
  const maxHeadline = MAX_TWEET_LENGTH - suffix.length;
  return `${headline.slice(0, maxHeadline)}${suffix}`;
}
