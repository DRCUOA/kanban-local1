/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions guard against null */
/**
 * Integration test: proves that deleting a task referenced by
 * inbound_email_processing.created_task_id does NOT violate the FK constraint.
 *
 * Requires a live PostgreSQL connection (DATABASE_URL).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './db';
import { tasks, stages, inboundEmailProcessing, INBOUND_PROCESSING_STATUS } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { DatabaseStorage } from './storage';

describe('Task deletion with inbound_email_processing FK reference', () => {
  const storage = new DatabaseStorage();
  let stageId: number;
  const testMessageIds: string[] = [];

  beforeEach(async () => {
    const [stage] = await db.insert(stages).values({ name: 'Test-Backlog', order: 0 }).returning();
    stageId = stage!.id;
    testMessageIds.length = 0;
  });

  afterEach(async () => {
    for (const msgId of testMessageIds) {
      await db
        .delete(inboundEmailProcessing)
        .where(eq(inboundEmailProcessing.gmailMessageId, msgId));
    }
    await db.delete(tasks).where(eq(tasks.stageId, stageId));
    await db.delete(stages).where(eq(stages.id, stageId));
  });

  it('deletes a task that is referenced by inbound_email_processing.created_task_id', async () => {
    const task = await storage.createTask({ title: 'Email-created task', stageId });

    const msgId = `fk-test-${Date.now()}`;
    testMessageIds.push(msgId);

    await db.insert(inboundEmailProcessing).values({
      provider: 'gmail',
      gmailMessageId: msgId,
      processingStatus: INBOUND_PROCESSING_STATUS.COMPLETED,
      createdTaskId: task.id,
      createdTaskIds: [task.id],
      processedAt: new Date(),
    });

    await expect(storage.deleteTask(task.id)).resolves.toBeUndefined();

    const found = await storage.getTaskById(task.id);
    expect(found).toBeUndefined();

    const [row] = await db
      .select()
      .from(inboundEmailProcessing)
      .where(eq(inboundEmailProcessing.gmailMessageId, msgId));
    expect(row).toBeDefined();
    expect(row!.createdTaskId).toBeNull();
  });

  it('deletes a parent task whose children are also referenced by inbound rows', async () => {
    const parent = await storage.createTask({ title: 'Parent email task', stageId });
    const child = await storage.createTask({
      title: 'Child email task',
      stageId,
      parentTaskId: parent.id,
    });

    const msgId = `fk-test-parent-${Date.now()}`;
    testMessageIds.push(msgId);

    await db.insert(inboundEmailProcessing).values({
      provider: 'gmail',
      gmailMessageId: msgId,
      processingStatus: INBOUND_PROCESSING_STATUS.COMPLETED,
      createdTaskId: parent.id,
      createdTaskIds: [parent.id, child.id],
      processedAt: new Date(),
    });

    await expect(storage.deleteTask(parent.id)).resolves.toBeUndefined();

    const [row] = await db
      .select()
      .from(inboundEmailProcessing)
      .where(eq(inboundEmailProcessing.gmailMessageId, msgId));
    expect(row).toBeDefined();
    expect(row!.createdTaskId).toBeNull();
    expect(row!.createdTaskIds).not.toContain(parent.id);
  });

  it('deletes a task with no inbound references without error', async () => {
    const task = await storage.createTask({ title: 'Plain task', stageId });

    await expect(storage.deleteTask(task.id)).resolves.toBeUndefined();

    const found = await storage.getTaskById(task.id);
    expect(found).toBeUndefined();
  });
});
