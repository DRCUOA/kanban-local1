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
