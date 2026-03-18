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
    {
      dryRun: config.dryRun,
      singleRun: config.singleRun,
      pollInterval: config.pollIntervalMinutes,
      activePollIntervalSeconds: config.activePollIntervalSeconds,
    },
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
  let twitterNotifier: TwitterNotifier | undefined;

  if (config.twitter.appKey) {
    try {
      twitterNotifier = new TwitterNotifier(logger, config);
    } catch (err) {
      logger.warn({ err }, 'Twitter notifier disabled — check credentials');
    }
  }

  if (config.verifyCredentials) {
    if (!twitterNotifier) {
      logger.error('Cannot verify credentials — Twitter credentials not configured');
      process.exit(1);
    }
    try {
      const { id, username } = await twitterNotifier.verifyCredentials();
      logger.info({ id, username }, `✓ Twitter credentials valid — authenticated as @${username}`);
    } catch (err) {
      logger.error({ err }, '✗ Twitter credentials invalid');
      process.exit(1);
    }
    await closeDb();
    return;
  }

  if (twitterNotifier && !config.dryRun) {
    notifiers.push(twitterNotifier);
    logger.info('Twitter notifier enabled');
  } else if (config.dryRun) {
    logger.info('DRY RUN mode — tweets will not be posted');
  }

  const runner = new Runner(
    store,
    notifiers,
    logger,
    config.dryRun,
    config.activePollIntervalSeconds,
    config.healthcheckUrl
  );

  if (config.singleRun) {
    logger.info('Single-run mode — executing once and exiting');
    try {
      await runner.poll();
    } finally {
      await closeDb();
    }
    return;
  }

  // Continuous mode: scoreboard tier on a fixed interval, game watchers managed by runner
  const scoreboardIntervalMs = config.pollIntervalMinutes * 60 * 1000;
  logger.info(
    { pollIntervalMinutes: config.pollIntervalMinutes, activePollIntervalSeconds: config.activePollIntervalSeconds },
    'Starting scoreboard polling loop'
  );

  // Run immediately on startup
  await runner.pollScoreboard();

  const scoreboardInterval = setInterval(async () => {
    try {
      await runner.pollScoreboard();
    } catch (err) {
      logger.error({ err }, 'Scoreboard poll error');
    }
  }, scoreboardIntervalMs);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    clearInterval(scoreboardInterval);
    runner.shutdown();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
