/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- Drizzle migrator + pg Client typings */
import path from 'path';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '@shared/logger';

/**
 * Applies SQL migrations from ./migrations (cwd must be project root — true in Docker and local npm start).
 *
 * One connection, so every statement shares a session. It opens unpinned to
 * read the zone the server gives a session by default — the zone every
 * `now()` this app wrote before sessions were pinned was stored in — hands
 * that to the migrations as `kanban.legacy_time_zone` (0025 repairs rows
 * with it), and then pins the session to UTC like the app's own pool, so a
 * migration's `now()` (a `DEFAULT now()` filling existing rows) is UTC too.
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before running migrations');
  }

  const migrationsFolder = path.join(process.cwd(), 'migrations');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const shown = await client.query<{ TimeZone: string }>('SHOW TimeZone');
    const serverZone = shown.rows[0]?.TimeZone ?? 'UTC';
    await client.query("SELECT set_config('kanban.legacy_time_zone', $1, false)", [serverZone]);
    await client.query("SET TIME ZONE 'UTC'");
    logger.info(`Database server TimeZone is ${serverZone}; sessions run in UTC`);

    await migrate(drizzle(client), { migrationsFolder });
    logger.info('Database migrations applied');
  } finally {
    await client.end();
  }
}
