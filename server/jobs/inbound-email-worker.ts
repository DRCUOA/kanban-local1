import { INBOUND_PROCESSING_STATUS } from '@shared/schema';
import { TASK_PRIORITY } from '@shared/constants';
import { getGmailApi } from '../gmail/gmail-client';
import { hashBody, normalizeGmailMessageParts } from '../gmail/normalize-email';
import { MAX_ATTEMPTS } from '../gmail/constants';
import {
  claimNextPendingRow,
  getInboundById,
  markInboundCompleted,
  markInboundFailed,
  markInboundPendingRetry,
  reconcileExpiredLeases,
} from '../inbound-email/repository';
import { invokeEmailTaskGraph } from '../langgraph/email-task-graph';
import { resolveStageId } from '../langgraph/stage-resolve';
import { storage } from '../storage';
import { logger } from '@shared/logger';
import type { InsertTask } from '@shared/schema';

function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  want: string,
): string {
  const lower = want.toLowerCase();
  for (const h of headers ?? []) {
    if ((h.name ?? '').toLowerCase() === lower) return (h.value ?? '').trim();
  }
  return '';
}

function recipientMatches(filter: string | undefined, toHeader: string): boolean {
  if (!filter?.trim()) return true;
  return toHeader.toLowerCase().includes(filter.trim().toLowerCase());
}

export async function processOneInboundRow(): Promise<void> {
  await reconcileExpiredLeases();
  const row = await claimNextPendingRow();
  if (!row) return;

  const fresh = await getInboundById(row.id);
  if (fresh?.processingStatus !== INBOUND_PROCESSING_STATUS.PROCESSING) {
    return;
  }

  try {
    const gmail = getGmailApi();
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: fresh.gmailMessageId,
      format: 'full',
    });
    const payload = msg.data.payload;
    const snippet = msg.data.snippet ?? '';
    const headers = payload?.headers ?? [];
    const subject = getHeader(headers, 'Subject') || '(no subject)';
    const to = getHeader(headers, 'To');
    const rfcId = getHeader(headers, 'Message-ID') || null;

    const filter = process.env.GMAIL_TRIGGER_RECIPIENT;
    if (!recipientMatches(filter, to)) {
      logger.info('Inbound email skipped: recipient filter', { id: fresh.id, to });
      await markInboundCompleted(fresh.id, null);
      return;
    }

    const norm = normalizeGmailMessageParts(payload, snippet);
    const bodyText = norm.plainBody || norm.snippetFallback;
    const bodyHash = hashBody(bodyText);

    const extraction = await invokeEmailTaskGraph({ subject, body: bodyText });
    const stages = await storage.getStages();
    const { stageId } = resolveStageId(stages, extraction.targetStageName);

    const priorityMap: Record<string, NonNullable<InsertTask['priority']>> = {
      low: 'low',
      normal: 'normal',
      high: 'high',
      critical: 'critical',
    };
    const priority = extraction.priority ? priorityMap[extraction.priority] : TASK_PRIORITY.NORMAL;

    const task = await storage.createTask({
      title: extraction.title || subject,
      description: extraction.description ?? null,
      stageId,
      priority,
    });

    await markInboundCompleted(fresh.id, task.id);

    logger.info('Inbound email processed', {
      inbound_row_id: fresh.id,
      gmail_message_id: fresh.gmailMessageId,
      attempt_count: fresh.attemptCount,
      final_outcome: 'completed',
      created_task_id: task.id,
      rfc_message_id: rfcId,
      normalized_body_hash: bodyHash,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logger.error('Inbound processing failed', { id: row.id, err });
    const rel = await getInboundById(row.id);
    const attempts = rel?.attemptCount ?? row.attemptCount;
    if (attempts >= MAX_ATTEMPTS) {
      await markInboundFailed(row.id, err);
      logger.info('Inbound email failed (max attempts)', {
        inbound_row_id: row.id,
        gmail_message_id: row.gmailMessageId,
        attempt_count: attempts,
        final_outcome: 'failed',
      });
    } else {
      await markInboundPendingRetry(row.id, err);
    }
  }
}

export function startInboundEmailWorker(): void {
  if (process.env.GMAIL_INBOUND_WORKER_DISABLED === 'true') {
    logger.warn('GMAIL_INBOUND_WORKER_DISABLED: inbound email worker not started');
    return;
  }
  const interval = parseInt(process.env.GMAIL_INBOUND_POLL_MS ?? '15000', 10);
  setInterval(() => {
    void processOneInboundRow().catch((e: unknown) => {
      logger.error('inbound worker tick', e);
    });
  }, interval);
  logger.info(`Inbound email worker polling every ${interval}ms`);
}
