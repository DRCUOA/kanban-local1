/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions guard against null */
/**
 * Integration test: task_attachments against a live PostgreSQL. Covers what
 * the in-memory contract cannot: the bytea round-trip, the in-database copy,
 * and the ON DELETE CASCADE from tasks.
 *
 * Requires a live PostgreSQL connection (DATABASE_URL).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './db';
import { tasks, stages, taskAttachments } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { DatabaseStorage } from './storage';
import {
  extractInlineAttachments,
  prepareDescriptionAttachments,
  syncTaskAttachments,
} from './attachments';

describe('task_attachments', () => {
  const storage = new DatabaseStorage();
  let stageId: number;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);
  const inlineChip = `<a data-file-chip="" data-file-name="shot.png" data-file-type="image/png" href="data:image/png;base64,${png.toString('base64')}" class="file-chip">shot.png</a>`;
  const upload = (filename: string, taskId: number | null) => ({
    taskId,
    filename,
    mimeType: 'image/png',
    data: png,
  });

  beforeEach(async () => {
    const [stage] = await db
      .insert(stages)
      .values({ name: 'Test-Attachments', order: 0 })
      .returning();
    stageId = stage!.id;
  });

  afterEach(async () => {
    await db.delete(taskAttachments).where(isNull(taskAttachments.taskId));
    await db.delete(tasks).where(eq(tasks.stageId, stageId));
    await db.delete(stages).where(eq(stages.id, stageId));
  });

  it('round-trips the bytes and serves metadata without them', async () => {
    const meta = await storage.createAttachment(upload('shot.png', null));

    expect(meta).toMatchObject({
      taskId: null,
      filename: 'shot.png',
      mimeType: 'image/png',
      byteSize: png.length,
    });
    expect(meta).not.toHaveProperty('data');
    const row = await storage.getAttachment(meta.id);
    expect(row!.data.equals(png)).toBe(true);
    expect(await storage.getAttachmentsMeta([meta.id, 999_999])).toHaveLength(1);
  });

  it('moves a file held inline into a row on save and binds it to the task', async () => {
    const prepared = await prepareDescriptionAttachments(storage, `<p>${inlineChip}</p>`, null);
    const task = await storage.createTask({
      title: 'With file',
      stageId,
      description: prepared.description,
    });
    await syncTaskAttachments(storage, task.id, prepared.attachmentIds, { release: false });

    const [attachment] = await storage.getAttachmentsByTasks([task.id], { withData: true });
    expect(attachment!.taskId).toBe(task.id);
    expect(attachment!.data!.equals(png)).toBe(true);
    expect(task.description).toContain(`href="/api/attachments/${attachment!.id}"`);
    expect(task.description).not.toContain('data:');
  });

  it("copies another task's attachment inside the database", async () => {
    const owner = await storage.createTask({ title: 'Owner', stageId });
    const original = await storage.createAttachment(upload('shot.png', owner.id));

    const copy = await storage.copyAttachment(original.id);

    expect(copy).toMatchObject({
      taskId: null,
      filename: 'shot.png',
      mimeType: 'image/png',
      byteSize: png.length,
    });
    expect(copy!.id).not.toBe(original.id);
    expect((await storage.getAttachment(copy!.id))!.data.equals(png)).toBe(true);
  });

  it('never binds a row another task owns', async () => {
    const a = await storage.createTask({ title: 'A', stageId });
    const b = await storage.createTask({ title: 'B', stageId });
    const owned = await storage.createAttachment(upload('shot.png', a.id));

    expect(await storage.bindAttachments(b.id, [owned.id])).toEqual([]);
    expect((await storage.getAttachmentsMeta([owned.id]))[0]!.taskId).toBe(a.id);
  });

  it('releases dropped references, sweeps them by age, and cascades on task delete', async () => {
    const task = await storage.createTask({ title: 'T', stageId });
    const kept = await storage.createAttachment(upload('a.png', null));
    const dropped = await storage.createAttachment(upload('b.png', null));
    expect(await storage.bindAttachments(task.id, [kept.id, dropped.id])).toEqual([
      kept.id,
      dropped.id,
    ]);

    await storage.releaseAttachments(task.id, [kept.id]);
    expect((await storage.getAttachmentsMeta([dropped.id]))[0]!.taskId).toBeNull();

    await storage.deleteOrphanAttachments(new Date(Date.now() - 60_000));
    expect(await storage.getAttachmentsMeta([dropped.id])).toHaveLength(1);
    await storage.deleteOrphanAttachments(new Date(Date.now() + 60_000));
    expect(await storage.getAttachmentsMeta([dropped.id])).toEqual([]);

    await storage.deleteTask(task.id);
    expect(await storage.getAttachmentsMeta([kept.id])).toEqual([]);
  });

  it('extracts files still held inline at startup without touching updatedAt', async () => {
    // Written straight to storage, as descriptions were before attachments had rows.
    const legacy = await storage.createTask({
      title: 'Legacy',
      stageId,
      description: `<p>${inlineChip}</p>`,
    });

    expect(await storage.getTaskIdsWithInlineAttachments()).toContain(legacy.id);
    expect(await extractInlineAttachments(storage)).toBe(1);

    const after = await storage.getTaskById(legacy.id);
    expect(after!.description).toMatch(/href="\/api\/attachments\/\d+"/);
    expect(after!.description).not.toContain('data:');
    expect(after!.updatedAt).toEqual(legacy.updatedAt);
    expect((await storage.getAttachmentsByTasks([legacy.id]))[0]!.data).toBeUndefined();
    expect(await extractInlineAttachments(storage)).toBe(0);
  });
});
