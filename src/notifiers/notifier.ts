import { Alert } from '../types/alert.js';

export interface Notifier {
  send(alert: Alert, tweetText: string): Promise<void>;
  sendThread?(tweets: string[]): Promise<void>;
}
