/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- Drizzle migrator + pg Pool typings */
import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '@shared/logger';

/**
 * Applies SQL migrations from ./migrations (cwd must be project root — true in Docker and local npm start).
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before running migrations');
  }

  const migrationsFolder = path.join(process.cwd(), 'migrations');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations applied');
  } finally {
    await pool.end();
  }
}
