import { Logger } from 'pino';
import { Alert } from '../types/alert.js';
import { Notifier } from './notifier.js';

export class ConsoleNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

  async sendThread(tweets: string[]): Promise<void> {
    const total = tweets.length;
    for (let i = 0; i < total; i++) {
      this.logger.info(`[Thread ${i + 1}/${total}] ${tweets[i]}`);
    }
  }

  async send(alert: Alert, tweetText: string): Promise<void> {
    this.logger.info(
      {
        alertId: alert.id,
        rule: alert.rule,
        gameId: alert.gameId,
        priority: alert.priority,
        tweetText,
      },
      `[ALERT] ${alert.headline}`
    );
  }
}
