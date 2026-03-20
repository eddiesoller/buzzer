import { ScoreCardContext } from './score-card.js';

export type AlertPriority = 'low' | 'medium' | 'high';

export interface Alert {
  /** Deterministic ID: rule:gameId[:specifics] — used for deduplication */
  id: string;
  rule: string;
  gameId: string;
  headline: string;
  body: string;
  priority: AlertPriority;
  createdAt: Date;
  context?: ScoreCardContext;
}
