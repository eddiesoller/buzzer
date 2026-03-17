import { ColumnType, Insertable, RawBuilder, Selectable, Updateable } from 'kysely';

export interface GamesTable {
  id: string;
  state: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  period: number;
  clock: string;
  rule_data: ColumnType<Record<string, unknown>, string, string>;
  updated_at: ColumnType<Date, never, Date | RawBuilder<unknown>>;
}

export interface FiredAlertsTable {
  alert_id: string;
  rule: string;
  game_id: string;
  headline: string;
  priority: string;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  games: GamesTable;
  fired_alerts: FiredAlertsTable;
}

export type GameRow = Selectable<GamesTable>;
export type NewGameRow = Insertable<GamesTable>;
export type UpdateGameRow = Updateable<GamesTable>;

export type FiredAlertRow = Selectable<FiredAlertsTable>;
export type NewFiredAlertRow = Insertable<FiredAlertsTable>;
