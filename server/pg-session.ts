/**
 * Startup options for every Postgres session the server opens: run it in UTC.
 *
 * The schema's timestamps carry no time zone, and drizzle reads one as UTC and
 * writes a JS Date as UTC. `now()` (behind every `defaultNow()` column and the
 * `sql\`now()\`` writes) gives the session's wall-clock time instead, so on a
 * Postgres whose TimeZone is Pacific/Auckland a row made this instant read
 * back 13 hours in the future, and the orphan-attachment sweep ran that late.
 * Pinning the session makes both sides agree whatever the server is set to.
 */
export const PG_SESSION_OPTIONS = '-c TimeZone=UTC';
