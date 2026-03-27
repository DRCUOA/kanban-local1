import { getGmailApi } from './gmail-client';
import { commitCursorAndInboundRows, getWatchCursor } from '../inbound-email/repository';
import { logger } from '@shared/logger';
import { RECOVERY_NEWER_THAN_QUERY } from './constants';

export function isStaleHistoryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number; response?: { status?: number }; message?: string };
  if (e.code === 404 || e.response?.status === 404) return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /history/i.test(msg) && (/invalid/i.test(msg) || /not.?found/i.test(msg));
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
      historyTypes: ['messageAdded'],
      pageToken,
    });
    for (const h of res.data.history ?? []) {
      for (const ma of h.messagesAdded ?? []) {
        if (ma.message?.id) messageIdSet.add(ma.message.id);
      }
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
}): Promise<void> {
  const { mailbox, notificationHistoryId, labelId } = params;
  const cursorBefore = await getWatchCursor(mailbox);
  const historyIdSeen = notificationHistoryId;

  if (!cursorBefore?.historyId) {
    logger.warn('No gmail_watch_cursor row; running 72h bounded recovery list');
    const rec = await recoveryListMessageIds(labelId);
    const upserts = rec.ids.map((id) => ({ gmailMessageId: id, historyIdSeen }));
    const newCursor = rec.latestHistoryId || notificationHistoryId;
    await commitCursorAndInboundRows({
      mailbox,
      newHistoryId: newCursor,
      upserts,
    });
    return;
  }

  try {
    const { messageIds, latestHistoryId } = await collectFromHistory(
      cursorBefore.historyId,
      labelId,
    );
    const upserts = messageIds.map((id) => ({
      gmailMessageId: id,
      historyIdSeen: latestHistoryId,
    }));
    await commitCursorAndInboundRows({
      mailbox,
      newHistoryId: latestHistoryId,
      upserts,
    });
  } catch (e) {
    if (isStaleHistoryError(e)) {
      logger.warn('Stale Gmail history cursor; running 72h bounded resync', e);
      const rec = await recoveryListMessageIds(labelId);
      const upserts = rec.ids.map((id) => ({ gmailMessageId: id, historyIdSeen }));
      const newCursor = rec.latestHistoryId || notificationHistoryId;
      await commitCursorAndInboundRows({
        mailbox,
        newHistoryId: newCursor,
        upserts,
      });
      return;
    }
    throw e;
  }
}
