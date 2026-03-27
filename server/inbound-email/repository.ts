import { db } from '../db';
import {
  gmailWatchCursor,
  inboundEmailProcessing,
  INBOUND_PROCESSING_STATUS,
  type InboundEmailProcessingRow,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { LEASE_MS, MAX_ATTEMPTS, PROVIDER_GMAIL } from '../gmail/constants';

export async function getWatchCursor(mailbox: string) {
  const rows = await db
    .select()
    .from(gmailWatchCursor)
    .where(eq(gmailWatchCursor.mailbox, mailbox));
  return rows[0];
}

export async function commitCursorAndInboundRows(params: {
  mailbox: string;
  newHistoryId: string;
  upserts: {
    gmailMessageId: string;
    historyIdSeen: string;
    normalizedSubject?: string | null;
    recipient?: string | null;
  }[];
}): Promise<void> {
  const { mailbox, newHistoryId, upserts } = params;
  await db.transaction(async (tx) => {
    for (const u of upserts) {
      await tx
        .insert(inboundEmailProcessing)
        .values({
          provider: PROVIDER_GMAIL,
          gmailMessageId: u.gmailMessageId,
          processingStatus: INBOUND_PROCESSING_STATUS.PENDING,
          historyIdSeen: u.historyIdSeen,
          normalizedSubject: u.normalizedSubject ?? null,
          recipient: u.recipient ?? null,
        })
        .onConflictDoUpdate({
          target: [inboundEmailProcessing.provider, inboundEmailProcessing.gmailMessageId],
          set: {
            updatedAt: new Date(),
          },
        });
    }
    await tx
      .insert(gmailWatchCursor)
      .values({
        mailbox,
        historyId: newHistoryId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [gmailWatchCursor.mailbox],
        set: {
          historyId: newHistoryId,
          updatedAt: new Date(),
        },
      });
  });
}

export async function getInboundById(id: number): Promise<InboundEmailProcessingRow | undefined> {
  const rows = await db
    .select()
    .from(inboundEmailProcessing)
    .where(eq(inboundEmailProcessing.id, id));
  return rows[0];
}

export async function reconcileExpiredLeases(): Promise<void> {
  await db.execute(sql`
    UPDATE inbound_email_processing
    SET processing_status = ${INBOUND_PROCESSING_STATUS.PENDING},
        lease_expires_at = NULL,
        updated_at = NOW()
    WHERE processing_status = ${INBOUND_PROCESSING_STATUS.PROCESSING}
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < NOW()
      AND attempt_count < ${MAX_ATTEMPTS}
  `);
  await db.execute(sql`
    UPDATE inbound_email_processing
    SET processing_status = ${INBOUND_PROCESSING_STATUS.FAILED},
        error_reason = 'Lease expired at max attempts',
        processed_at = NOW(),
        updated_at = NOW()
    WHERE processing_status = ${INBOUND_PROCESSING_STATUS.PROCESSING}
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < NOW()
      AND attempt_count >= ${MAX_ATTEMPTS}
  `);
}

export async function claimNextPendingRow(): Promise<InboundEmailProcessingRow | undefined> {
  return db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(inboundEmailProcessing)
      .where(eq(inboundEmailProcessing.processingStatus, INBOUND_PROCESSING_STATUS.PENDING))
      .for('update', { skipLocked: true })
      .limit(1);
    const row = pending[0];
    if (!row) return undefined;
    const [updated] = await tx
      .update(inboundEmailProcessing)
      .set({
        processingStatus: INBOUND_PROCESSING_STATUS.PROCESSING,
        lastAttemptAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
        attemptCount: row.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(inboundEmailProcessing.id, row.id))
      .returning();
    return updated;
  });
}

export async function markInboundFailed(id: number, reason: string): Promise<void> {
  await db
    .update(inboundEmailProcessing)
    .set({
      processingStatus: INBOUND_PROCESSING_STATUS.FAILED,
      errorReason: reason,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inboundEmailProcessing.id, id));
}

export async function markInboundPendingRetry(id: number, reason: string): Promise<void> {
  await db
    .update(inboundEmailProcessing)
    .set({
      processingStatus: INBOUND_PROCESSING_STATUS.PENDING,
      errorReason: reason,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(inboundEmailProcessing.id, id));
}

export async function markInboundCompleted(id: number, taskId: number | null): Promise<void> {
  await db
    .update(inboundEmailProcessing)
    .set({
      processingStatus: INBOUND_PROCESSING_STATUS.COMPLETED,
      createdTaskId: taskId,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inboundEmailProcessing.id, id));
}
