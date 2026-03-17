import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './schema.js';
import { Config } from '../config.js';

let db: Kysely<Database> | null = null;

export function createDb(config: Config): Kysely<Database> {
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    max: 5,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

export function getDb(): Kysely<Database> {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function initDb(config: Config): Kysely<Database> {
  db = createDb(config);
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
