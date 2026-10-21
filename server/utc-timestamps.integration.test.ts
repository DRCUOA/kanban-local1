/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- test assertions guard against null; supertest bodies are untyped JSON */
/**
 * Integration test: a timestamp the database stamps itself means the same
 * instant as one the app writes, whatever the Postgres server's own TimeZone.
 *
 * Every timestamp column is `timestamp` without time zone read back as UTC,
 * and `now()` is cast into the session's zone, so on a server set to
 * Pacific/Auckland a task created at 07:28Z was served as 20:28Z. The test
 * gives every connection that zone as its default (PGOPTIONS, which pg reads
 * for any connection that sets no options of its own), so it fails without
 * the UTC pin on any server, including one that is itself UTC.
 *
 * Requires a live PostgreSQL connection (DATABASE_URL).
 */
import fs from 'fs';
import path from 'path';
import { createServer, type Server } from 'http';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq, inArray, sql, TransactionRollbackError, type SQL } from 'drizzle-orm';
import { tasks, stages, taskAttachments } from '@shared/schema';
import { serveOnLoopback, closeServer } from './test-support/loopback';

const NOT_UTC = 'Pacific/Auckland';
/** Generous against clock skew between Node and the database; the bug is hours. */
const TOLERANCE_MS = 60_000;

describe('timestamps on a Postgres whose TimeZone is not UTC', () => {
  let db: (typeof import('./db'))['db'];
  let app: express.Express;
  /** `app`, listening on 127.0.0.1 (see test-support/loopback.ts). */
  let server: Server;
  let stageId: number;

  beforeAll(async () => {
    vi.stubEnv('PGOPTIONS', `-c TimeZone=${NOT_UTC}`);
    // Node in the same zone, as on a laptop in Auckland: a zone-less string
    // handed to new Date() is then read as local time.
    vi.stubEnv('TZ', NOT_UTC);
    vi.stubEnv('CODE_HASH_KEY', '');
    ({ db } = await import('./db'));
    const { registerRoutes } = await import('./routes');
    app = express();
    app.use(express.json());
    await registerRoutes(createServer(app), app);
    server = await serveOnLoopback(app);

    const [stage] = await db.insert(stages).values({ name: 'Test-UTC', order: 0 }).returning();
    stageId = stage!.id;
  });

  afterAll(async () => {
    await closeServer(server);
    await db.delete(tasks).where(eq(tasks.stageId, stageId));
    await db.delete(stages).where(eq(stages.id, stageId));
    vi.unstubAllEnvs();
  });

  it('runs every session the app opens in UTC', async () => {
    const shown = await db.execute<{ TimeZone: string }>(sql`SHOW TimeZone`);
    expect(shown.rows[0]!.TimeZone).toBe('UTC');
  });

  it('serves a new task from GET /api/tasks with the time it was created', async () => {
    const before = Date.now();
    const created = await request(server).post('/api/tasks').send({ title: 'Made now', stageId });
    const after = Date.now();
    expect(created.status).toBe(201);

    const list = await request(server).get('/api/tasks');
    const task = (list.body as { id: number }[]).find((t) => t.id === created.body.id) as
      | Record<string, string>
      | undefined;
    expect(task).toBeDefined();
    // createdAt and viewedAt are column defaults; updatedAt is a Date the app writes.
    for (const field of ['createdAt', 'viewedAt', 'updatedAt']) {
      const at = Date.parse(task![field]!);
      expect(at, field).toBeGreaterThanOrEqual(before - TOLERANCE_MS);
      expect(at, field).toBeLessThanOrEqual(after + TOLERANCE_MS);
    }
  });

  it('reads a timestamp from a raw query as UTC', async () => {
    const { DatabaseStorage } = await import('./storage');
    const storage = new DatabaseStorage();
    const before = Date.now();
    const original = await storage.createAttachment({
      taskId: null,
      filename: 'note.txt',
      mimeType: 'text/plain',
      data: Buffer.from('note'),
    });
    // copyAttachment reads created_at back from raw SQL text, not a typed select.
    const copy = await storage.copyAttachment(original.id);
    const after = Date.now();
    await db.delete(taskAttachments).where(inArray(taskAttachments.id, [original.id, copy!.id]));

    expect(copy!.createdAt.getTime()).toBeGreaterThanOrEqual(before - TOLERANCE_MS);
    expect(copy!.createdAt.getTime()).toBeLessThanOrEqual(after + TOLERANCE_MS);
  });

  it('migration 0025 moves values stored in local time to UTC and leaves the rest', async () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '0025_utc_timestamps.sql'),
      'utf8',
    );
    const repair = migration.split('--> statement-breakpoint').find((s) => s.includes('DO $$'))!;
    let after: Record<string, string> = {};

    // Run inside a transaction that is always rolled back: the repair walks
    // every row of its tables, and this database may be someone's dev board.
    await db
      .transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('kanban.legacy_time_zone', ${NOT_UTC}, true)`);
        const [stage] = await tx
          .insert(stages)
          // 20:28 in Auckland on 21 Oct (NZDT, +13) is 07:28Z.
          .values({
            name: 'Test-UTC-repair',
            order: 0,
            createdAt: new Date('2026-10-21T20:28:00Z'),
          })
          .returning();
        const untouched = await tx
          .insert(tasks)
          .values({
            title: 'Defaulted together, never written since',
            stageId: stage!.id,
            // 09:43 in Auckland on 18 Aug (NZST, +12) is 21:43Z the day before.
            createdAt: new Date('2026-08-18T09:43:13Z'),
            updatedAt: new Date('2026-08-18T09:43:13Z'),
            viewedAt: sql`now()`,
          })
          .returning();
        const edited = await tx
          .insert(tasks)
          .values({
            title: 'Written by the app since',
            stageId: stage!.id,
            createdAt: new Date('2026-08-18T09:43:13Z'),
            updatedAt: new Date('2026-10-01T02:00:00Z'),
          })
          .returning();

        await tx.execute(sql.raw(repair));

        const read = async (query: SQL) => (await tx.execute<{ v: string }>(query)).rows[0]!.v;
        after = {
          stage: await read(sql`SELECT created_at::text AS v FROM stages WHERE id = ${stage!.id}`),
          untouchedCreated: await read(
            sql`SELECT created_at::text AS v FROM tasks WHERE id = ${untouched[0]!.id}`,
          ),
          untouchedUpdated: await read(
            sql`SELECT updated_at::text AS v FROM tasks WHERE id = ${untouched[0]!.id}`,
          ),
          thisRunViewed: await read(
            sql`SELECT (viewed_at = (now() AT TIME ZONE 'UTC'))::text AS v FROM tasks WHERE id = ${untouched[0]!.id}`,
          ),
          editedUpdated: await read(
            sql`SELECT updated_at::text AS v FROM tasks WHERE id = ${edited[0]!.id}`,
          ),
          reported: await read(
            sql`SELECT count(*)::text AS v FROM utc_timestamp_repair_report WHERE table_name = 'stages' AND row_key = ${String(stage!.id)}`,
          ),
        };
        tx.rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });

    expect(after).toEqual({
      stage: '2026-10-21 07:28:00',
      untouchedCreated: '2026-08-17 21:43:13',
      untouchedUpdated: '2026-08-17 21:43:13',
      // Written by now() in this transaction, under the UTC pin: already UTC.
      thisRunViewed: 'true',
      editedUpdated: '2026-10-01 02:00:00',
      reported: '1',
    });
  });
});
