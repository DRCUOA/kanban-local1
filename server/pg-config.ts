import type { PoolConfig } from 'pg';

/**
 * Every timestamp column is `timestamp` without time zone holding UTC
 * wall-clock time: Drizzle writes a Date as its UTC ISO string and reads a
 * stored value back as UTC. `now()` does not follow that rule — each
 * `defaultNow()` column default and every `NOW()` in server SQL is cast into
 * the session's TimeZone — so on a Postgres whose own TimeZone is not UTC (a
 * Homebrew server set to Pacific/Auckland) a default stored local time and
 * the API served it 13 hours in the future, while a Date the app wrote came
 * back right. Pinning the session to UTC makes both kinds of write agree on
 * every server, and makes `lease_expires_at < NOW()` compare like with like.
 */
export const UTC_SESSION_OPTION = '-c TimeZone=UTC';

/**
 * Pool settings for the server's own connections. PGOPTIONS, which pg reads
 * only when no `options` are given, is kept and the pin follows it: the last
 * `-c` for a setting wins. A DATABASE_URL carrying its own `options=`
 * parameter would replace both, since pg lets the URL win.
 */
export function utcPoolConfig(connectionString: string): PoolConfig {
  const options = [process.env.PGOPTIONS, UTC_SESSION_OPTION].filter(Boolean).join(' ');
  return { connectionString, options };
}
