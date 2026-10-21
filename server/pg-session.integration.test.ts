/**
 * Integration test: the server's Postgres sessions run in UTC whatever the
 * database's own TimeZone is (server/pg-session.ts).
 *
 * Requires a live PostgreSQL connection (DATABASE_URL).
 */
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from './db';

describe('Postgres session time zone', () => {
  it('is UTC, so now() written to a timestamp column reads back as the current instant', async () => {
    const { rows } = await db.execute<{ tz: string; wall: string }>(
      sql`select current_setting('TimeZone') as tz, now()::timestamp::text as wall`,
    );
    const row = rows[0];
    expect(row?.tz).toBe('UTC');
    // Read the wall-clock text the way drizzle reads a timestamp column: as UTC.
    const readBack = new Date(`${row?.wall ?? ''}+0000`);
    expect(Math.abs(readBack.getTime() - Date.now())).toBeLessThan(60_000);
  });
});
