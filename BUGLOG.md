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

---

## BUG-004: due days read a day early if you take the date part of `dueDate`

**Date:** 2026-08-13
**Severity:** Medium (no wrong buckets shipped; the payload misled the consumer reading it)
**Follows:** BUG-003, whose Pacific/Auckland day cut is deployed and working.

### What was reported

Cards 140, 141 and 145 store `dueDate: "2026-08-13T12:00:00.000Z"`, were read as "due 13 August", and the live briefing bucketed all three as `dueBucket: "tomorrow"` with `dueToday: []` on 13 August NZ. The proposed fix was to derive a task's due day from the stored instant's **UTC date part**.

### What the code actually does

Checked before changing anything, and it inverts the premise.

The writer is `react-day-picker` v8 (`mode="single"`), whose day cells are built with date-fns `startOfMonth`/`startOfWeek`/`addDays` — all local-time. `onSelect` returns **local midnight**, which `JSON.stringify` sends as UTC. Reproduced in NZ:

```
picker Date for "13 Aug": Thu Aug 13 2026 00:00:00 GMT+1200
sent to server (JSON):    {"dueDate":"2026-08-12T12:00:00.000Z"}
```

So for a picker-written card the instant's UTC date part is **the day before** the label. Both candidate conventions produce a value ending `T12:00:00.000Z` during NZST, which is why the stored value alone cannot distinguish them.

The board agrees with the NZ-local reading: `TaskCard.tsx` used `isPast`/`isToday`/`format`, all browser-local, so `2026-08-13T12:00:00.000Z` renders as **"Due: Aug 14"**. Confirmed against the live board — cards 140/141/145 display Aug 14. Their `dueBucket: "tomorrow"` on 13 August was therefore correct, and `dueToday: []` was correct.

Deriving the due day from the UTC date part would have moved every picker-written card one day *earlier* than the board shows it — reporting cards overdue a day early and filling `dueToday` with tomorrow's work. That is the mirror image of the reported defect, applied to the whole board.

### Root cause of the real defect

The payload never stated the labeled day. It emitted `dueDate` as a raw UTC instant, and `overdueRule` spoke of "its dueDate" as though the date part were the day. A consumer — here an LLM briefing agent — that took `"2026-08-13T12:00:00.000Z".slice(0,10)` read every card a day early and then, reasonably, reported the bucket as contradicting it. The buckets were right; the field the agent needed did not exist.

### Fix

- `dueDayFor(dueDate, zone)` in `shared/briefing.ts` is now the single derivation of a card's labeled calendar date, with `isOverdueOn` / `isDueTodayOn` / `formatDueDayLabel` beside it.
- `dueDay` (YYYY-MM-DD) is emitted on both `tasks[].urgency` and every `briefing` entry, so no consumer has to parse a date out of an instant. `dueDate` is unchanged for back-compat.
- `overdueRuleFor(zone)` now names `dueDay` as the field to compare and says outright that the `dueDate` instant's UTC date part is a day earlier.
- The board's own overdue logic uses the same helper: `shared/task-warning-highlight.ts`, `TaskCard.tsx` (highlight and the printed label) and `TaskWarnings.tsx` no longer cut days with browser-local `isPast`/`isToday`. The export's contract is that it matches the board's highlight; now one function decides both. Side effect: a card's day is the board's zone rather than the viewer's, so the label no longer shifts when the board is opened from another timezone.

Day-boundary derivation for `now` / `generatedFor` / bucket edges is untouched — BUG-003's zone cut stands. Nothing was changed in headers or deployment config.

### Tests

Due dates are now built the way production stores them (`duePicked` — the picked day at NZ local midnight, i.e. `T12:00:00.000Z` on the previous date), replacing the BUG-003 tests' NZ-noon instants, which could not see an offset defect by construction.

| Test | Proves |
|---|---|
| "is the day the picker stored, not the UTC date part of the instant" | The convention itself, asserted rather than assumed |
| "holds all day, from first light to last" | A card labeled 13 Aug is `today` at 00:00, 07:00, 12:00 and 23:00 NZT |
| "reads one day overdue at 7:00 AM the next morning" | `daysOverdue: 1` at 07:00 NZT on 14 Aug |
| "maps a card anchored in the NZDT season to its labeled date" | A +13 card (`2027-01-14T11:00:00.000Z`) labels as 15 Jan |
| "agrees with the label the card face shows" | The reported value maps to Aug 14 / `tomorrow` — the anti-regression for the inverted fix |
| "flags overdue for the board exactly as it does for the export" | Board helper and digest flip at the same instant |
| `export.test.ts` — "gives the client fallback and the route the same bundle" | Both export paths serialize identically |

380 tests pass under `TZ=UTC`, `America/New_York`, `Asia/Kolkata` and `Pacific/Auckland`.

### Not covered

`client/src/lib/task-email.ts` still formats a due date in the viewer's local zone for the "Share as email" text. Harmless from an NZ device and outside this change; worth folding into the same helper if the board ever gains non-NZ users.
