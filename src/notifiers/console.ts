import { Logger } from 'pino';
import { Alert } from '../types/alert.js';
import { Notifier } from './notifier.js';

export class ConsoleNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

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
