import { getGmailApi } from './gmail-client';
import { commitCursorAndInboundRows, getWatchCursor } from '../inbound-email/repository';
import { logger } from '@shared/logger';
import { RECOVERY_NEWER_THAN_QUERY } from './constants';
import { getErrorTraceFields, logGmailInboundTrace } from './inbound-trace';

interface HistoryMessageRef {
  message?: { id?: string | null } | null;
}

interface HistoryEntry {
  messagesAdded?: HistoryMessageRef[] | null;
  labelsAdded?: HistoryMessageRef[] | null;
}

export function isStaleHistoryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number; response?: { status?: number }; message?: string };
  if (e.code === 404 || e.response?.status === 404) return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /history/i.test(msg) && (/invalid/i.test(msg) || /not.?found/i.test(msg));
}

export function extractTriggeredMessageIds(history: HistoryEntry[] | null | undefined): string[] {
  const messageIdSet = new Set<string>();

  for (const entry of history ?? []) {
    for (const event of entry.messagesAdded ?? []) {
      if (event.message?.id) messageIdSet.add(event.message.id);
    }
    for (const event of entry.labelsAdded ?? []) {
      if (event.message?.id) messageIdSet.add(event.message.id);
    }
  }

  return Array.from(messageIdSet);
}

async function recoveryListMessageIds(
  labelId: string,
): Promise<{ ids: string[]; latestHistoryId: string }> {
  const gmail = getGmailApi();
  const ids: string[] = [];
  let pageToken: string | undefined;
  const prof = await gmail.users.getProfile({ userId: 'me' });
  const latestHistoryId = prof.data.historyId?.toString() ?? '';
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      q: RECOVERY_NEWER_THAN_QUERY,
      maxResults: 100,
      pageToken,
    });
    for (const m of res.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return { ids, latestHistoryId };
}

async function collectFromHistory(
  startHistoryId: string,
  labelId: string,
): Promise<{ messageIds: string[]; latestHistoryId: string }> {
  const gmail = getGmailApi();
  const messageIdSet = new Set<string>();
  let latestHistoryId = startHistoryId;
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      labelId,
      historyTypes: ['messageAdded', 'labelAdded'],
      pageToken,
    });
    for (const messageId of extractTriggeredMessageIds(
      res.data.history as HistoryEntry[] | undefined,
    )) {
      messageIdSet.add(messageId);
    }
    const nextHid = res.data.historyId;
    if (nextHid != null) {
      latestHistoryId = typeof nextHid === 'number' ? String(nextHid) : nextHid;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return { messageIds: Array.from(messageIdSet), latestHistoryId };
}

export async function syncAfterPubSubNotification(params: {
  mailbox: string;
  notificationHistoryId: string;
  labelId: string;
  traceContext?: {
    traceId?: string;
    pubsubMessageId?: string | null;
    pubsubPublishTime?: string | null;
  };
}): Promise<void> {
  const { mailbox, notificationHistoryId, labelId, traceContext } = params;
  const cursorBefore = await getWatchCursor(mailbox);
  const historyIdSeen = notificationHistoryId;

  logGmailInboundTrace('sync.cursor_loaded', {
    trace_id: traceContext?.traceId,
    pubsub_message_id: traceContext?.pubsubMessageId,
    mailbox,
    notification_history_id: notificationHistoryId,
    stored_cursor_history_id: cursorBefore?.historyId ?? null,
    has_cursor: Boolean(cursorBefore?.historyId),
    label_id: labelId,
  });

  if (!cursorBefore?.historyId) {
    logger.warn('No gmail_watch_cursor row; running 72h bounded recovery list');
    logGmailInboundTrace('sync.recovery_started', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      notification_history_id: notificationHistoryId,
      label_id: labelId,
      recovery_query: RECOVERY_NEWER_THAN_QUERY,
      reason: 'missing_cursor',
    });
    const rec = await recoveryListMessageIds(labelId);
    const upserts = rec.ids.map((id) => ({ gmailMessageId: id, historyIdSeen }));
    const newCursor = rec.latestHistoryId || notificationHistoryId;
    logGmailInboundTrace('sync.recovery_collected', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      recovered_message_count: rec.ids.length,
      sample_gmail_message_ids: rec.ids.slice(0, 10),
      latest_history_id: rec.latestHistoryId || null,
      new_cursor_history_id: newCursor,
    });
    await commitCursorAndInboundRows({
      mailbox,
      newHistoryId: newCursor,
      upserts,
    });
    logGmailInboundTrace('sync.commit_completed', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      committed_message_count: upserts.length,
      new_cursor_history_id: newCursor,
      sync_mode: 'recovery',
    });
    return;
  }

  try {
    logGmailInboundTrace('sync.history_started', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      start_history_id: cursorBefore.historyId,
      notification_history_id: notificationHistoryId,
      label_id: labelId,
    });
    const { messageIds, latestHistoryId } = await collectFromHistory(
      cursorBefore.historyId,
      labelId,
    );
    logGmailInboundTrace('sync.history_collected', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      start_history_id: cursorBefore.historyId,
      latest_history_id: latestHistoryId,
      collected_message_count: messageIds.length,
      sample_gmail_message_ids: messageIds.slice(0, 10),
    });
    const upserts = messageIds.map((id) => ({
      gmailMessageId: id,
      historyIdSeen: latestHistoryId,
    }));
    await commitCursorAndInboundRows({
      mailbox,
      newHistoryId: latestHistoryId,
      upserts,
    });
    logGmailInboundTrace('sync.commit_completed', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      committed_message_count: upserts.length,
      new_cursor_history_id: latestHistoryId,
      sync_mode: 'history',
    });
  } catch (e) {
    if (isStaleHistoryError(e)) {
      logger.warn('Stale Gmail history cursor; running 72h bounded resync', e);
      logGmailInboundTrace('sync.stale_history_recovery', {
        trace_id: traceContext?.traceId,
        pubsub_message_id: traceContext?.pubsubMessageId,
        mailbox,
        notification_history_id: notificationHistoryId,
        stale_cursor_history_id: cursorBefore.historyId,
        label_id: labelId,
        recovery_query: RECOVERY_NEWER_THAN_QUERY,
        ...getErrorTraceFields(e),
      });
      const rec = await recoveryListMessageIds(labelId);
      const upserts = rec.ids.map((id) => ({ gmailMessageId: id, historyIdSeen }));
      const newCursor = rec.latestHistoryId || notificationHistoryId;
      logGmailInboundTrace('sync.recovery_collected', {
        trace_id: traceContext?.traceId,
        pubsub_message_id: traceContext?.pubsubMessageId,
        mailbox,
        recovered_message_count: rec.ids.length,
        sample_gmail_message_ids: rec.ids.slice(0, 10),
        latest_history_id: rec.latestHistoryId || null,
        new_cursor_history_id: newCursor,
      });
      await commitCursorAndInboundRows({
        mailbox,
        newHistoryId: newCursor,
        upserts,
      });
      logGmailInboundTrace('sync.commit_completed', {
        trace_id: traceContext?.traceId,
        pubsub_message_id: traceContext?.pubsubMessageId,
        mailbox,
        committed_message_count: upserts.length,
        new_cursor_history_id: newCursor,
        sync_mode: 'stale_history_recovery',
      });
      return;
    }
    logGmailInboundTrace('sync.error', {
      trace_id: traceContext?.traceId,
      pubsub_message_id: traceContext?.pubsubMessageId,
      mailbox,
      notification_history_id: notificationHistoryId,
      label_id: labelId,
      ...getErrorTraceFields(e),
    });
    throw e;
  }
}
