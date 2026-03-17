import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  postgres: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    database: z.string().default('buzzer'),
    user: z.string().default('buzzer'),
    password: z.string().default('buzzer_secret'),
  }),
  twitter: z.object({
    appKey: z.string().optional(),
    appSecret: z.string().optional(),
    accessToken: z.string().optional(),
    accessSecret: z.string().optional(),
  }),
  healthcheckUrl: z.string().url().optional(),
  verifyCredentials: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  singleRun: z.boolean().default(false),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  pollIntervalMinutes: z.coerce.number().min(1).max(60).default(2),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const raw = {
    postgres: {
      host: process.env['POSTGRES_HOST'],
      port: process.env['POSTGRES_PORT'],
      database: process.env['POSTGRES_DB'],
      user: process.env['POSTGRES_USER'],
      password: process.env['POSTGRES_PASSWORD'],
    },
    twitter: {
      appKey: process.env['TWITTER_APP_KEY'] || undefined,
      appSecret: process.env['TWITTER_APP_SECRET'] || undefined,
      accessToken: process.env['TWITTER_ACCESS_TOKEN'] || undefined,
      accessSecret: process.env['TWITTER_ACCESS_SECRET'] || undefined,
    },
    healthcheckUrl: process.env['HEALTHCHECK_URL'] || undefined,
    verifyCredentials: process.argv.includes('--verify-credentials'),
    dryRun: process.env['DRY_RUN'] === 'true' || process.argv.includes('--dry-run'),
    singleRun: process.env['SINGLE_RUN'] === 'true' || process.argv.includes('--single-run'),
    logLevel: process.env['LOG_LEVEL'],
    pollIntervalMinutes: getArgValue('--poll-interval') ?? process.env['POLL_INTERVAL_MINUTES'],
  };

  return configSchema.parse(raw);
}

/** Returns the value of a --flag=value or --flag value CLI argument, or undefined. */
function getArgValue(flag: string): string | undefined {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
    if (arg === flag && i + 1 < args.length) return args[i + 1];
  }
  return undefined;
}
