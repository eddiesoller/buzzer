import { TwitterApi } from 'twitter-api-v2';
import { Logger } from 'pino';
import { Alert } from '../types/alert.js';
import { Notifier } from './notifier.js';
import { Config } from '../config.js';
import { generateScoreCard } from '../formatters/score-card.js';

export class TwitterNotifier implements Notifier {
  private client: TwitterApi;

  constructor(
    private readonly logger: Logger,
    config: Config
  ) {
    if (
      !config.twitter.appKey ||
      !config.twitter.appSecret ||
      !config.twitter.accessToken ||
      !config.twitter.accessSecret
    ) {
      throw new Error('Twitter credentials are not fully configured');
    }

    this.client = new TwitterApi({
      appKey: config.twitter.appKey,
      appSecret: config.twitter.appSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });
  }

  async verifyCredentials(): Promise<{ id: string; username: string }> {
    const { data } = await this.client.v2.me();
    return { id: data.id, username: data.username };
  }

  async sendThread(tweets: string[]): Promise<void> {
    if (tweets.length === 0) return;
    let lastTweetId: string | undefined;
    for (let i = 0; i < tweets.length; i++) {
      const tweetText = tweets[i];
      const opts = lastTweetId
        ? { reply: { in_reply_to_tweet_id: lastTweetId } }
        : undefined;
      try {
        const result = await this.client.v2.tweet(tweetText, opts);
        this.logger.info(
          { tweetId: result.data.id },
          `Thread tweet ${i + 1}/${tweets.length} posted`
        );
        lastTweetId = result.data.id;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 429) {
          this.logger.warn({ tweetIndex: i + 1 }, 'Twitter rate limit (429) — stopping thread');
          return;
        }
        this.logger.error({ err, tweetIndex: i + 1 }, 'Failed to post thread tweet');
        throw err;
      }
    }
  }

  async send(alert: Alert, tweetText: string): Promise<void> {
    let mediaId: string | undefined;
    if (alert.context) {
      try {
        const buf = await generateScoreCard(alert.context);
        mediaId = await this.client.v1.uploadMedia(buf, { mimeType: 'image/png' });
      } catch (err) {
        this.logger.warn({ err, alertId: alert.id }, 'Score card generation failed — text-only fallback');
      }
    }
    const tweetOpts = mediaId ? { media: { media_ids: [mediaId] as [string] } } : undefined;
    try {
      const result = await this.client.v2.tweet(tweetText, tweetOpts);
      this.logger.info(
        { tweetId: result.data.id, alertId: alert.id },
        `Tweet posted: ${alert.headline}`
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 429) {
        this.logger.warn(
          { alertId: alert.id },
          'Twitter rate limit (429) — skipping tweet'
        );
        return;
      }
      this.logger.error(
        { err, alertId: alert.id },
        'Failed to post tweet'
      );
      throw err;
    }
  }
}
