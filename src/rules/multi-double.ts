import { Game } from '../types/game.js';
import { Alert } from '../types/alert.js';
import { AlertRule, makeAlertId, findMultiDoubleCandidates, playerCardContext, countAtOrAbove, ACHIEVED_THRESHOLD, APPROACHING_THRESHOLD, formatScore, gamePeriodLabel } from './rule.js';

export class MultiDoubleRule implements AlertRule {
  readonly name = 'multi-double';

  evaluate(game: Game): Alert[] {
    const alerts: Alert[] = [];
    const candidates = findMultiDoubleCandidates(game, 2);

    for (const { player, team, status, stats } of candidates) {
      const values = stats.map((s) => s.value);

      if (status === 'achieved') {
        const achievedCount = countAtOrAbove(values, ACHIEVED_THRESHOLD);
        let type: string;
        let headline: string;
        let priority: 'high' | 'medium';

        if (achievedCount >= 4) {
          type = 'quadruple-double';
          headline = `Quadruple-Double: ${player.playerName}!`;
          priority = 'high';
        } else if (achievedCount >= 3) {
          type = 'triple-double';
          headline = `Triple-Double: ${player.playerName}!`;
          priority = 'high';
        } else {
          type = 'double-double';
          headline = `Double-Double: ${player.playerName}!`;
          priority = 'medium';
        }

        const statStr = stats.filter((s) => s.value >= ACHIEVED_THRESHOLD).map((s) => `${s.value}${s.label}`).join('/');
        const cardStatLine = stats.filter((s) => s.value >= ACHIEVED_THRESHOLD).map((s) => `${s.value} ${s.label.toUpperCase()}`).join('  ');
        alerts.push({
          id: makeAlertId(type, game.id, player.playerId),
          rule: this.name,
          gameId: game.id,
          headline: `${headline} (${statStr})`,
          body: `${formatScore(game.awayTeam, game.homeTeam)} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock}`,
          priority,
          createdAt: new Date(),
          context: playerCardContext(player, team, cardStatLine, game, priority),
        });
      } else {
        // approaching — only for triple and quadruple, skip double-double
        const approachingCount = countAtOrAbove(values, APPROACHING_THRESHOLD);
        if (approachingCount < 3) continue;

        let type: string;
        let label: string;

        if (approachingCount >= 4) {
          type = 'quadruple-double-approaching';
          label = 'quadruple-double';
        } else {
          type = 'triple-double-approaching';
          label = 'triple-double';
        }

        const statStr = stats.filter((s) => s.value >= APPROACHING_THRESHOLD).map((s) => `${s.value}${s.label}`).join('/');
        const cardStatLine = stats.filter((s) => s.value >= APPROACHING_THRESHOLD).map((s) => `${s.value} ${s.label.toUpperCase()}`).join('  ');
        alerts.push({
          id: makeAlertId(type, game.id, player.playerId),
          rule: this.name,
          gameId: game.id,
          headline: `${player.playerName} approaching ${label} (${statStr})`,
          body: `${formatScore(game.awayTeam, game.homeTeam)} | ${gamePeriodLabel(game.period, game.halftime)} | ${game.clock} remaining`,
          priority: 'medium',
          createdAt: new Date(),
          context: playerCardContext(player, team, cardStatLine, game, 'medium'),
        });
      }
    }

    return alerts;
  }
}
