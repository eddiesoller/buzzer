import { Game, margin, estimateSecondsRemaining, isLive, leadingTeam } from '../types/game.js';
import { Alert, AlertPriority } from '../types/alert.js';
import { AlertRule, makeAlertId, formatScore, formatWinPct, gameCardContext } from './rule.js';

const CLOSE_GAME_MARGIN = 5;
const CLOSE_GAME_SECONDS_REMAINING = 5 * 60;

export class CloseGameRule implements AlertRule {
  readonly name = 'close-game';

  evaluate(game: Game): Alert[] {
    const diff = margin(game);

    // Close game alert — live, 2nd half, ≤5 min remaining
    if (!isLive(game) || game.period !== 2) return [];

    const remaining = estimateSecondsRemaining(game);
    if (remaining > CLOSE_GAME_SECONDS_REMAINING) return [];
    if (diff > CLOSE_GAME_MARGIN) return [];

    const minutesLeft = Math.ceil(remaining / 60);
    const scoreStr = formatScore(game.awayTeam, game.homeTeam);

    const leader = leadingTeam(game);
    const leaderWinPct = leader !== null
      ? (leader.id === game.homeTeam.id ? game.homeWinPct : game.awayWinPct)
      : undefined;

    let priority: AlertPriority;
    if (diff === 0) {
      priority = 'high';
    } else if (leaderWinPct !== undefined) {
      priority = leaderWinPct > 0.65 ? 'medium' : 'high';
    } else {
      priority = 'medium';
    }

    const homeWinPct = game.homeWinPct ?? 0.5;
    const awayWinPct = game.awayWinPct ?? 0.5;
    const favoredTeam = homeWinPct >= awayWinPct ? game.homeTeam : game.awayTeam;
    const winPctStr = formatWinPct(game, favoredTeam);

    const baseHeadline = diff === 0
      ? `TIED GAME with ${minutesLeft}m left — ${scoreStr}`
      : `Close game! ${minutesLeft}m left — ${scoreStr}`;
    const headline = winPctStr ? `${baseHeadline} | ${winPctStr}` : baseHeadline;
    const bodyWinPctStr = leader !== null ? formatWinPct(game, leader) : null;
    const awayLabel = game.awayTeam.seed != null ? `(${game.awayTeam.seed}) ${game.awayTeam.shortName}` : game.awayTeam.shortName;
    const homeLabel = game.homeTeam.seed != null ? `(${game.homeTeam.seed}) ${game.homeTeam.shortName}` : game.homeTeam.shortName;
    const body = bodyWinPctStr
      ? `${awayLabel} vs ${homeLabel} | ${game.clock} - 2nd Half | ${bodyWinPctStr}`
      : `${awayLabel} vs ${homeLabel} | ${game.clock} - 2nd Half`;

    return [{
      id: makeAlertId(this.name, game.id),
      rule: this.name,
      gameId: game.id,
      headline,
      body,
      priority,
      createdAt: new Date(),
      context: gameCardContext(game, 'CLOSE GAME', priority),
    }];
  }
}
