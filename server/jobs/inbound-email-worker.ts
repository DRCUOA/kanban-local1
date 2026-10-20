import {
  INBOUND_PROCESSING_STATUS,
  type InboundEmailProcessingRow,
  type InsertTask,
  type Stage,
} from '@shared/schema';
import { TASK_PRIORITY } from '@shared/constants';
import { logger } from '@shared/logger';
import { getGmailApi } from '../gmail/gmail-client';
import { hashBody, normalizeGmailMessageParts } from '../gmail/normalize-email';
import { MAX_ATTEMPTS } from '../gmail/constants';
import { getErrorTraceFields, logGmailInboundTrace } from '../gmail/inbound-trace';
import { PROVIDER_INBOX } from '../inbox/constants';
import {
  applySubjectDirectives,
  extractionMode,
  firstLineOf,
  parseSubjectDirectives,
  plainExtraction,
} from '../inbox/extraction';
import {
  claimNextPendingRow,
  getInboundById,
  markInboundCompleted,
  markInboundFailed,
  markInboundPendingRetry,
  reconcileExpiredLeases,
} from '../inbound-email/repository';
import { invokeEmailTaskGraph, type EmailTaskExtraction } from '../langgraph/email-task-graph';
import { resolveStageId } from '../langgraph/stage-resolve';
import { createEmailTasks, storage } from '../storage';

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

const priorityMap: Record<string, NonNullable<InsertTask['priority']>> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  critical: 'critical',
};

function mapPriority(priority: string | null | undefined): NonNullable<InsertTask['priority']> {
  return (priority ? priorityMap[priority] : undefined) ?? TASK_PRIORITY.NORMAL;
}

function buildTaskInsert(input: {
  draft: {
    title: string;
    description: string | null;
    priority: string | null;
    targetStageName: string | null;
  };
  fallbackTitle: string;
  fallbackStageName: string | null;
  stages: Stage[];
}): {
  task: InsertTask;
  resolvedStageId: number;
  requestedStageName: string | null;
} {
  const requestedStageName = input.draft.targetStageName ?? input.fallbackStageName;
  const { stageId } = resolveStageId(input.stages, requestedStageName);
  return {
    task: {
      title: input.draft.title || input.fallbackTitle,
      description: input.draft.description ?? null,
      stageId,
      priority: mapPriority(input.draft.priority),
    },
    resolvedStageId: stageId,
    requestedStageName,
  };
}

/** The message as the extraction reads it, however it arrived. */
interface LoadedMessage {
  subject: string;
  bodyText: string;
  rfcId: string | null;
  bodySource: 'plain_body' | 'snippet_fallback' | 'stored';
}

/**
 * A Gmail row holds only the message id, so the message is fetched again from
 * Gmail; GMAIL_TRIGGER_RECIPIENT may then rule it out (null).
 */
async function loadGmailMessage(fresh: InboundEmailProcessingRow): Promise<LoadedMessage | null> {
  const gmail = getGmailApi();
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: fresh.messageKey,
    format: 'full',
  });
  const payload = msg.data.payload;
  const snippet = msg.data.snippet ?? '';
  const headers = payload?.headers ?? [];
  const subject = getHeader(headers, 'Subject');
  const to = getHeader(headers, 'To');
  const rfcId = getHeader(headers, 'Message-ID') || null;

  logGmailInboundTrace('worker.gmail_message_fetched', {
    inbound_row_id: fresh.id,
    message_key: fresh.messageKey,
    history_id_seen: fresh.historyIdSeen,
    attempt_count: fresh.attemptCount,
    rfc_message_id: rfcId,
    has_payload: Boolean(payload),
    snippet_length: snippet.length,
    subject_length: subject.length,
    to_header_present: Boolean(to),
  });

  const filter = process.env.GMAIL_TRIGGER_RECIPIENT;
  if (!recipientMatches(filter, to)) {
    logGmailInboundTrace('worker.recipient_skipped', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      recipient_filter: filter ?? null,
      to_header: to || null,
    });
    logger.info('Inbound email skipped: recipient filter', { id: fresh.id, to });
    return null;
  }

  const norm = normalizeGmailMessageParts(payload, snippet);
  return {
    subject,
    bodyText: norm.plainBody || norm.snippetFallback,
    rfcId,
    bodySource: norm.plainBody ? 'plain_body' : 'snippet_fallback',
  };
}

/** An inbox row carries the message itself (server/inbox); there is nowhere else to fetch it from. */
function loadInboxMessage(fresh: InboundEmailProcessingRow): LoadedMessage {
  return {
    subject: (fresh.subject ?? '').trim(),
    bodyText: (fresh.bodyText ?? '').trim(),
    rfcId: fresh.rfcMessageId,
    bodySource: 'stored',
  };
}

export async function processOneInboundRow(): Promise<void> {
  await reconcileExpiredLeases();
  const row = await claimNextPendingRow();
  if (!row) {
    logGmailInboundTrace('worker.no_pending_row');
    return;
  }

  logGmailInboundTrace('worker.row_claimed', {
    inbound_row_id: row.id,
    provider: row.provider,
    message_key: row.messageKey,
    attempt_count: row.attemptCount,
    history_id_seen: row.historyIdSeen,
  });

  const fresh = await getInboundById(row.id);
  if (fresh?.processingStatus !== INBOUND_PROCESSING_STATUS.PROCESSING) {
    logGmailInboundTrace('worker.row_not_processing', {
      inbound_row_id: row.id,
      message_key: row.messageKey,
      observed_processing_status: fresh?.processingStatus ?? null,
    });
    return;
  }

  try {
    const message =
      fresh.provider === PROVIDER_INBOX ? loadInboxMessage(fresh) : await loadGmailMessage(fresh);
    if (message === null) {
      await markInboundCompleted(fresh.id, null, []);
      return;
    }

    const bodyHash = hashBody(message.bodyText);
    // `!high` and `@stage` in the subject hold in either mode; the model only
    // ever sees the subject without them.
    const directives = parseSubjectDirectives(message.subject);
    const fallbackTitle = directives.title || firstLineOf(message.bodyText) || '(no subject)';
    const mode = extractionMode();

    logGmailInboundTrace('worker.extraction_started', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      normalized_body_hash: bodyHash,
      body_length: message.bodyText.length,
      body_source: message.bodySource,
      extraction_mode: mode,
      directive_priority: directives.priority,
      directive_stage: directives.stageName,
    });

    const stagesPromise = storage.getStages();
    const extractionPromise: Promise<EmailTaskExtraction> =
      mode === 'plain'
        ? Promise.resolve(plainExtraction(message.subject, message.bodyText))
        : invokeEmailTaskGraph({
            subject: directives.title,
            body: message.bodyText,
            traceContext: {
              inboundRowId: fresh.id,
              messageKey: fresh.messageKey,
              historyIdSeen: fresh.historyIdSeen ?? undefined,
              normalizedBodyHash: bodyHash,
            },
          }).then((extracted) => applySubjectDirectives(extracted, directives));
    const [stages, extraction] = await Promise.all([stagesPromise, extractionPromise]);

    logGmailInboundTrace('worker.extraction_completed', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      normalized_body_hash: bodyHash,
      extraction_mode: mode,
      extracted_parent_title_present: Boolean(extraction.parentTask.title),
      extracted_parent_priority: extraction.parentTask.priority ?? null,
      extracted_parent_target_stage_name: extraction.parentTask.targetStageName ?? null,
      extracted_parent_description_present: Boolean(extraction.parentTask.description),
      extracted_child_task_count: extraction.childTasks.length,
      extracted_is_epic: extraction.flags.isEpic,
      extracted_used_web_search: extraction.flags.usedWebSearch,
    });

    const parentTask = buildTaskInsert({
      draft: extraction.parentTask,
      fallbackTitle,
      fallbackStageName: null,
      stages,
    });
    const childTasks = extraction.childTasks.map((child) =>
      buildTaskInsert({
        draft: child,
        fallbackTitle: child.title,
        fallbackStageName: extraction.parentTask.targetStageName,
        stages,
      }),
    );

    logGmailInboundTrace('worker.stage_resolved', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      requested_stage_name: parentTask.requestedStageName ?? null,
      resolved_stage_id: parentTask.resolvedStageId,
      child_requested_stage_names: childTasks.map((child) => child.requestedStageName ?? ''),
      child_resolved_stage_ids: childTasks.map((child) => child.resolvedStageId),
    });

    const created = await createEmailTasks({
      parent: parentTask.task,
      children: childTasks.map((child) => child.task),
    });
    const createdTaskIds = [created.parent.id, ...created.children.map((child) => child.id)];

    logGmailInboundTrace('worker.task_group_created', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      created_task_id: created.parent.id,
      created_task_ids: createdTaskIds,
      resolved_stage_id: parentTask.resolvedStageId,
      child_task_count: created.children.length,
    });

    await markInboundCompleted(fresh.id, created.parent.id, createdTaskIds);

    logGmailInboundTrace('worker.completed', {
      inbound_row_id: fresh.id,
      message_key: fresh.messageKey,
      history_id_seen: fresh.historyIdSeen,
      created_task_id: created.parent.id,
      created_task_ids: createdTaskIds,
      final_outcome: 'completed',
      normalized_body_hash: bodyHash,
    });

    logger.info('Inbound email processed', {
      inbound_row_id: fresh.id,
      provider: fresh.provider,
      message_key: fresh.messageKey,
      attempt_count: fresh.attemptCount,
      extraction_mode: mode,
      final_outcome: 'completed',
      created_task_id: created.parent.id,
      created_task_ids: createdTaskIds,
      rfc_message_id: message.rfcId,
      normalized_body_hash: bodyHash,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logGmailInboundTrace('worker.error', {
      inbound_row_id: row.id,
      message_key: row.messageKey,
      history_id_seen: row.historyIdSeen,
      attempt_count: row.attemptCount,
      ...getErrorTraceFields(e),
    });
    logger.error('Inbound processing failed', { id: row.id, err });
    const rel = await getInboundById(row.id);
    const attempts = rel?.attemptCount ?? row.attemptCount;
    if (attempts >= MAX_ATTEMPTS) {
      await markInboundFailed(row.id, err);
      logGmailInboundTrace('worker.failed_max_attempts', {
        inbound_row_id: row.id,
        message_key: row.messageKey,
        history_id_seen: row.historyIdSeen,
        attempt_count: attempts,
        final_outcome: 'failed',
      });
      logger.info('Inbound email failed (max attempts)', {
        inbound_row_id: row.id,
        message_key: row.messageKey,
        attempt_count: attempts,
        final_outcome: 'failed',
      });
    } else {
      await markInboundPendingRetry(row.id, err);
      logGmailInboundTrace('worker.retry_scheduled', {
        inbound_row_id: row.id,
        message_key: row.messageKey,
        history_id_seen: row.historyIdSeen,
        attempt_count: attempts,
        final_outcome: 'pending_retry',
      });
    }
  }
}

/**
 * Polls the queue, which both the Gmail pipeline and POST /api/inbox feed.
 * GMAIL_INBOUND_WORKER_DISABLED stops it, and with it the inbox.
 */
export function startInboundEmailWorker(): void {
  if (process.env.GMAIL_INBOUND_WORKER_DISABLED === 'true') {
    logger.warn('GMAIL_INBOUND_WORKER_DISABLED: inbound email worker not started');
    return;
  }
  const interval = parseInt(process.env.GMAIL_INBOUND_POLL_MS ?? '15000', 10);
  logGmailInboundTrace('worker.started', {
    poll_interval_ms: interval,
    worker_disabled: false,
    extraction_mode: extractionMode(),
  });
  setInterval(() => {
    void processOneInboundRow().catch((e: unknown) => {
      logger.error('inbound worker tick', e);
    });
  }, interval);
  logger.info(`Inbound email worker polling every ${interval}ms`);
}
