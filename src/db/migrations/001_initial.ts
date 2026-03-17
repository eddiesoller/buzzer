import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('games')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('state', 'varchar(16)', (col) => col.notNull())
    .addColumn('home_team', 'varchar(128)', (col) => col.notNull())
    .addColumn('away_team', 'varchar(128)', (col) => col.notNull())
    .addColumn('home_score', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('away_score', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('period', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('clock', 'varchar(16)', (col) => col.notNull().defaultTo(''))
    .addColumn('rule_data', 'jsonb', (col) => col.notNull().defaultTo('{}'))
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable('fired_alerts')
    .ifNotExists()
    .addColumn('alert_id', 'varchar(256)', (col) => col.primaryKey())
    .addColumn('rule', 'varchar(64)', (col) => col.notNull())
    .addColumn('game_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('headline', 'text', (col) => col.notNull())
    .addColumn('priority', 'varchar(16)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('fired_alerts_game_id_idx')
    .ifNotExists()
    .on('fired_alerts')
    .column('game_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('fired_alerts').ifExists().execute();
  await db.schema.dropTable('games').ifExists().execute();
}
