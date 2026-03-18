import { Kysely, sql, RawBuilder } from 'kysely';
import { Database } from '../db/schema.js';
import { Game } from '../types/game.js';
import { Alert } from '../types/alert.js';

export class StateStore {
  constructor(private readonly db: Kysely<Database>) {}

  /** Load the last-known snapshot for a game */
  async loadGame(gameId: string): Promise<Game | null> {
    const row = await this.db
      .selectFrom('games')
      .selectAll()
      .where('id', '=', gameId)
      .executeTakeFirst();

    if (!row) return null;

    return row.rule_data as unknown as Game;
  }

  /** Save/update a game snapshot */
  async saveGame(game: Game): Promise<void> {
    const ruleDataJson = sql<string>`${JSON.stringify(game)}::jsonb`;

    await this.db
      .insertInto('games')
      .values({
        id: game.id,
        state: game.status,
        home_team: game.homeTeam.name,
        away_team: game.awayTeam.name,
        home_score: game.homeTeam.score,
        away_score: game.awayTeam.score,
        period: game.period,
        clock: game.clock,
        rule_data: ruleDataJson,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          state: game.status,
          home_score: game.homeTeam.score,
          away_score: game.awayTeam.score,
          period: game.period,
          clock: game.clock,
          rule_data: ruleDataJson,
          updated_at: sql`now()`,
        })
      )
      .execute();
  }

  /** Mark an alert as fired */
  async markAlertFired(alert: Alert): Promise<void> {
    await this.db
      .insertInto('fired_alerts')
      .values({
        alert_id: alert.id,
        rule: alert.rule,
        game_id: alert.gameId,
        headline: alert.headline,
        priority: alert.priority,
      })
      .onConflict((oc) => oc.column('alert_id').doNothing())
      .execute();
  }

  /** Filter out already-fired alerts */
  async filterNewAlerts(alerts: Alert[]): Promise<Alert[]> {
    if (alerts.length === 0) return [];

    const ids = alerts.map((a) => a.id);
    const existing = await this.db
      .selectFrom('fired_alerts')
      .select('alert_id')
      .where('alert_id', 'in', ids)
      .execute();

    const firedIds = new Set(existing.map((r) => r.alert_id));
    return alerts.filter((a) => !firedIds.has(a.id));
  }
}
