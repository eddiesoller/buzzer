import { Kysely, Migrator } from 'kysely';
import { Database } from './schema.js';
import * as migration001 from './migrations/001_initial.js';

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return {
          '001_initial': migration001,
        };
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`Migration "${result.migrationName}" applied successfully`);
    } else if (result.status === 'Error') {
      console.error(`Migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    throw new Error(`Migration failed: ${error}`);
  }
}
