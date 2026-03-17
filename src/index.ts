import cron from 'node-cron';
import pino from 'pino';
import { loadConfig } from './config.js';
import { initDb, closeDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { StateStore } from './state/store.js';
import { Runner } from './runner.js';
import { Notifier } from './notifiers/notifier.js';
import { ConsoleNotifier } from './notifiers/console.js';
import { TwitterNotifier } from './notifiers/twitter.js';

async function main() {
  const config = loadConfig();

  const logger = pino({
    level: config.logLevel,
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });

  logger.info(
    { dryRun: config.dryRun, singleRun: config.singleRun, pollInterval: config.pollIntervalMinutes },
    'Buzzer starting'
  );

  const db = initDb(config);

  try {
    await runMigrations(db);
  } catch (err) {
    logger.fatal({ err }, 'Migration failed — exiting');
    process.exit(1);
  }

  const store = new StateStore(db);

  const notifiers: Notifier[] = [new ConsoleNotifier(logger)];

  if (!config.dryRun && config.twitter.appKey) {
    try {
      notifiers.push(new TwitterNotifier(logger, config));
      logger.info('Twitter notifier enabled');
    } catch (err) {
      logger.warn({ err }, 'Twitter notifier disabled — check credentials');
    }
  } else if (config.dryRun) {
    logger.info('DRY RUN mode — tweets will not be posted');
  }

  const runner = new Runner(store, notifiers, logger, config.dryRun, config.healthcheckUrl);

  if (config.singleRun) {
    logger.info('Single-run mode — executing once and exiting');
    try {
      await runner.poll();
    } finally {
      await closeDb();
    }
    return;
  }

  // Cron mode: run on schedule
  const cronExpression = `*/${config.pollIntervalMinutes} * * * *`;
  logger.info({ cronExpression }, 'Scheduling cron job');

  // Run immediately on startup
  await runner.poll();

  cron.schedule(cronExpression, async () => {
    try {
      await runner.poll();
    } catch (err) {
      logger.error({ err }, 'Poll error');
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
