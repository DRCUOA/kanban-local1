# Bug Log

Tracking investigations, root causes, tests, and fixes.

---

## BUG-001: Deleting a task fails with FK constraint error

**Date:** 2026-03-29
**Severity:** High (blocks task deletion in production)
**Error:**
```
update or delete on table "tasks" violates foreign key constraint
"inbound_email_processing_created_task_id_tasks_id_fk" on table "inbound_email_processing"
```

### What happens

When a user deletes a task that was originally created by the email ingest pipeline, Postgres refuses the delete because `inbound_email_processing.created_task_id` still points to that task.

### Root cause

`deleteTask()` in `server/storage.ts` ran a bare `DELETE FROM tasks` without first clearing the reference in `inbound_email_processing`. The FK was set to `ON DELETE NO ACTION`, so Postgres blocks any delete while a row still references the task.

### Fix

1. **App code** (`server/storage.ts` — `deleteTask`): before deleting, null out `created_task_id` and scrub the task id from the `created_task_ids` JSONB array on any referencing rows.
2. **Migration** (`migrations/0006_fk_created_task_id_set_null.sql`): changed FK to `ON DELETE SET NULL` as defense-in-depth.
3. **Schema** (`shared/schema.ts`): updated Drizzle FK declaration to `onDelete: 'set null'`.

### Tests

`server/delete-task-fk.integration.test.ts` — 3 cases against real Postgres:

| # | Test | Proves |
|---|------|--------|
| 1 | Delete a task referenced by `created_task_id` | The exact production bug |
| 2 | Delete a parent task listed in `created_task_ids` | JSONB array cleanup works |
| 3 | Delete a task with no inbound references | No regression for normal deletes |

All 3 failed before the fix (same FK error as production), all pass after.

---

## BUG-002: Deploy fails — `drizzle-kit: not found`

**Date:** 2026-04-02
**Severity:** Critical (blocks deployment)
**Error:**
```
sh: 1: drizzle-kit: not found
```

### What happens

Railway runs `npm run db:push` (which calls `drizzle-kit push`) at container startup. `drizzle-kit` is a devDependency, and the production Docker image installs only production deps (`npm ci --omit=dev`), so the binary isn't there. Container dies immediately.

### Root cause

The Railway dashboard has `npm run db:push` set as a **pre-deploy command**. This runs between build and deploy, using the production image which only has production deps. Two problems:

1. `drizzle-kit` is a devDependency — not installed in the production image (`npm ci --omit=dev`).
2. `drizzle-kit push` is a development tool that diffs live schema against TypeScript source. Production should use SQL file migrations instead.

The server already handles migrations correctly: `server/index.ts` calls `runMigrations()` at boot, which applies SQL files from `migrations/` using the drizzle-orm migrator (a runtime dependency).

### Fix

Set `"preDeployCommand": null` in `railway.json` to override the dashboard setting and disable the broken pre-deploy step. Also set explicit `"startCommand": "node dist/index.cjs"`. Migrations run automatically at server boot.

### Verification

Check the next deploy logs for:
- No `drizzle-kit` errors
- `Database migrations applied` (from `runMigrations()`)
- `serving on port ...` (server started successfully)

---

## BUG-003: `/api/export` served a stale snapshot, and cut days in UTC

**Date:** 2026-08-13
**Severity:** High (the 7:00 AM NZT briefing was reporting a day-old, wrong-day board)

Two independent defects, both reached through the same request, both invisible to a reader of the payload — the response looked internally consistent while being wrong.

### Defect 1 — the response was cached

`GET /api/export?view=briefing` returned `exportedAt: 2026-08-12T07:23:37Z` when fetched at 19:12 that evening and again near midnight: one 12-hour-old snapshot, replayed for the identical URL. Adding a junk query parameter forced a fresh build, which proved the app could regenerate per request and that something keyed on the exact URL was pinning the response.

**Root cause:** the route set no cache directives at all, so a caching layer was free to treat a board that changes all day as a static document.

**Fix** (`server/routes.ts`): set, before any branch of the handler so error responses are covered too —

```
Cache-Control: no-store, no-cache, must-revalidate
CDN-Cache-Control: no-store
Pragma: no-cache
Expires: 0
```

`CDN-Cache-Control` covers an edge that ignores `Cache-Control`; `Pragma`/`Expires` cover HTTP/1.0 proxies that ignore both. **If a CDN still holds the URL**, add a cache-bypass rule for `/api/export*` at the edge — origin headers are the fix here, but only an edge that honours them.

### Defect 2 — day boundaries were cut in UTC

The digest reported `"timezone": "UTC"` and a `generatedFor` of the UTC calendar date. New Zealand runs 12–13 hours ahead, so for every NZ morning (midnight–noon NZT) the export's "today" was still yesterday: `daysOverdue` one low, and `dueToday` showing yesterday's cards. The 7:00 AM NZT briefing was structurally a day behind.

**Root cause:** `shared/briefing.ts` cut calendar days with date-fns `startOfDay`/`differenceInCalendarDays`, which use the host zone, and `resolveTimezone()` reported that host zone. The server runs in UTC, so the payload was honestly declaring the wrong boundary rather than using the board's own.

**Fix** (`shared/briefing.ts`, `shared/export.ts`, `server/routes.ts`):

- `zonedDayKey` / `differenceInZonedCalendarDays` read the calendar day back out of `Intl.DateTimeFormat` for a named zone, so NZDT is handled by the platform's zone database instead of an assumed +12.
- `DEFAULT_TIMEZONE = 'Pacific/Auckland'`, threaded through `computeTaskUrgency`, `annotateTasksWithUrgency`, `buildExportBundle` and the digest — `now`, `generatedFor`, `daysOverdue`, `dueBucket` and the overdue/dueToday bucketing all cut in that zone.
- `?tz=` accepts any IANA zone (`GET /api/export?view=briefing&tz=Pacific/Auckland`), defaulting to `Pacific/Auckland`. An unknown zone is a 400, not a silent fallback: a briefing cut in the wrong zone looks correct and is a day out.
- `overdueRule` names the zone actually used rather than referring to a field.

Nothing else about the payload changed — field names, `briefingRank`, the conflict flags and `overdueRule` semantics are as they were. Only the zone the day is cut in.

### Tests

| Test | Proves |
|---|---|
| `server/routes.test.ts` — "forbids caching the response" / "…error responses too" | Both directives ship on 200s and 400s |
| `server/routes.test.ts` — "rebuilds the payload on every request to the same URL" | Two fetches of one URL five seconds apart carry different `exportedAt` |
| `server/routes.test.ts` — "cuts the day in New Zealand, not the UTC the server runs in" | At 07:00 NZT on 13 Aug, `generatedFor` is `2026-08-13`, not `2026-08-12` |
| `shared/briefing.test.ts` — "counts a card due yesterday NZ time as one day overdue at 7:00 AM NZT" | The exact acceptance case; the same input cut in UTC reads "due today" |
| `shared/briefing.test.ts` — "tracks NZDT, not a hardcoded +12" | A +13 instant lands on the right NZ day |
| `shared/export.test.ts` — `exportQuerySchema` cases | Default zone, explicit zone, 400 on an unknown one |

The existing briefing tests built their instants with host-local `Date` constructors, which cannot see a host-zone bug by construction. They now pin an explicit NZ offset, and the suite passes identically under `TZ=UTC`, `America/New_York`, `Asia/Kolkata` and `Pacific/Auckland`.
