import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { utcPoolConfig } from './pg-config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Sessions run in UTC whatever the server's own TimeZone (see pg-config).
export const db = drizzle({ connection: utcPoolConfig(process.env.DATABASE_URL), schema });
