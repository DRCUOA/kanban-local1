/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions guard against null */
/**
 * Integration test: a stage keeps the `kind` it was created with. Covers what
 * the in-memory contract cannot: `DatabaseStorage.createStage` built its insert
 * from name, order and colour only, so `kind` fell to the column default and
 * the seed's In Progress and Done, and every column added from Admin, were
 * stored as backlog.
 *
 * Requires a live PostgreSQL connection (DATABASE_URL).
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { stages, tasks, type InsertStage, type Stage } from '@shared/schema';
import { SEED_STAGE_NAMES, STAGE_KIND } from '@shared/constants';
import { DatabaseStorage, type IStorage } from './storage';
import { seedDatabase } from './seed';
import { createApp } from './app';

describe('stage kind is stored as given', () => {
  const storage = new DatabaseStorage();
  const createdStageIds: number[] = [];

  afterEach(async () => {
    if (createdStageIds.length === 0) return;
    await db.delete(tasks).where(inArray(tasks.stageId, createdStageIds));
    await db.delete(stages).where(inArray(stages.id, createdStageIds));
    createdStageIds.length = 0;
  });

  async function storedKind(id: number): Promise<string | undefined> {
    const [row] = await db.select().from(stages).where(eq(stages.id, id));
    return row?.kind;
  }

  it('seeds Backlog, In Progress and Done with their own kinds', async () => {
    // The seed only runs on a board with no stages. Other integration files
    // share this database, so the seed is shown an empty board and writes
    // through the real storage, which records what it created for clean-up.
    const emptyBoard = Object.create(storage, {
      getStages: { value: () => Promise.resolve([]) },
      createStage: {
        value: async (stage: InsertStage) => {
          const created = await storage.createStage(stage);
          createdStageIds.push(created.id);
          return created;
        },
      },
    }) as IStorage;

    await seedDatabase(emptyBoard);

    const ours = await db
      .select()
      .from(stages)
      .where(inArray(stages.id, createdStageIds))
      .orderBy(stages.order);

    expect(ours.map((s) => [s.name, s.kind])).toEqual([
      [SEED_STAGE_NAMES.BACKLOG, STAGE_KIND.BACKLOG],
      [SEED_STAGE_NAMES.IN_PROGRESS, STAGE_KIND.IN_PROGRESS],
      [SEED_STAGE_NAMES.DONE, STAGE_KIND.DONE],
    ]);

    // A task's first history line is the kind of the column it was created
    // in, so the seeded Done task opens as done rather than backlog.
    const doneStage = ours.find((s) => s.name === SEED_STAGE_NAMES.DONE)!;
    const [doneTask] = await db.select().from(tasks).where(eq(tasks.stageId, doneStage.id));
    expect(doneTask!.history![0]!.status).toBe(STAGE_KIND.DONE);
  });

  it('keeps the kind chosen in Admin through POST /api/stages', async () => {
    const { app } = await createApp();

    const res = await request(app)
      .post('/api/stages')
      .send({ name: 'Test-Kind-Done', order: 900, kind: STAGE_KIND.DONE });
    const created = res.body as Stage;

    expect(res.status).toBe(201);
    createdStageIds.push(created.id);
    expect(created.kind).toBe(STAGE_KIND.DONE);
    expect(await storedKind(created.id)).toBe(STAGE_KIND.DONE);
  });

  it('stores backlog when no kind is sent', async () => {
    const { app } = await createApp();

    const res = await request(app).post('/api/stages').send({ name: 'Test-Kind-None', order: 901 });
    const created = res.body as Stage;

    expect(res.status).toBe(201);
    createdStageIds.push(created.id);
    expect(await storedKind(created.id)).toBe(STAGE_KIND.BACKLOG);
  });
});
