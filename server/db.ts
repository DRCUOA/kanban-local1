import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { PG_SESSION_OPTIONS } from './pg-session';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

export const db = drizzle({
  connection: { connectionString: process.env.DATABASE_URL, options: PG_SESSION_OPTIONS },
  schema,
});
