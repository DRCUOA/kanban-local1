import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { verifyPubSubPushJwt } from '../gmail/pubsub-verify';
import { syncAfterPubSubNotification } from '../gmail/history-sync';
import { logger } from '@shared/logger';
import { getErrorTraceFields, logGmailInboundTrace } from '../gmail/inbound-trace';

export const GMAIL_PUBSUB_WEBHOOK_PATH = '/api/webhooks/gmail-pubsub';

async function handleGmailPubSub(req: Request, res: Response): Promise<void> {
  const traceId = randomUUID();
  try {
    const envelope = req.body as {
      message?: { data?: string; messageId?: string; publishTime?: string };
      subscription?: string;
    };
    const pubsubMessageId = envelope.message?.messageId ?? null;
    const pubsubPublishTime = envelope.message?.publishTime ?? null;

    logGmailInboundTrace('webhook.received', {
      trace_id: traceId,
      pubsub_message_id: pubsubMessageId,
      pubsub_publish_time: pubsubPublishTime,
      subscription: envelope.subscription ?? null,
      has_authorization_header: Boolean(req.get('Authorization')),
    });

    const audience = process.env.GMAIL_PUBSUB_AUDIENCE;
    if (!audience) {
      throw new Error('GMAIL_PUBSUB_AUDIENCE must be set to the push endpoint URL (OIDC audience)');
    }
    await verifyPubSubPushJwt(req.get('Authorization'), audience);

    logGmailInboundTrace('webhook.jwt_verified', {
      trace_id: traceId,
      pubsub_message_id: pubsubMessageId,
      audience,
    });

    const raw = envelope.message?.data;
    if (!raw) {
      logGmailInboundTrace('webhook.invalid_payload', {
        trace_id: traceId,
        pubsub_message_id: pubsubMessageId,
        reason: 'missing_message_data',
      });
      res.status(400).send('missing message data');
      return;
    }
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as {
      emailAddress?: string;
      historyId?: string | number;
    };
    const mailbox = json.emailAddress ?? process.env.GMAIL_MAILBOX;
    const historyId = json.historyId != null ? String(json.historyId) : '';
    if (!mailbox || !historyId) {
      logGmailInboundTrace('webhook.invalid_payload', {
        trace_id: traceId,
        pubsub_message_id: pubsubMessageId,
        mailbox: mailbox ?? null,
        notification_history_id: historyId || null,
        reason: 'missing_mailbox_or_history_id',
      });
      res.status(400).send('invalid notification payload');
      return;
    }
    const labelId = process.env.GMAIL_LABEL_ID;
    if (!labelId) {
      throw new Error('GMAIL_LABEL_ID is required');
    }

    logGmailInboundTrace('webhook.sync_started', {
      trace_id: traceId,
      pubsub_message_id: pubsubMessageId,
      mailbox,
      notification_history_id: historyId,
      label_id: labelId,
    });

    await syncAfterPubSubNotification({
      mailbox,
      notificationHistoryId: historyId,
      labelId,
      traceContext: {
        traceId,
        pubsubMessageId,
        pubsubPublishTime,
      },
    });

    logGmailInboundTrace('webhook.sync_completed', {
      trace_id: traceId,
      pubsub_message_id: pubsubMessageId,
      mailbox,
      notification_history_id: historyId,
      label_id: labelId,
    });
    res.status(204).end();
  } catch (e) {
    logGmailInboundTrace('webhook.error', {
      trace_id: traceId,
      ...getErrorTraceFields(e),
    });
    logger.error('gmail pubsub webhook error', e);
    res.status(500).send('internal error');
  }
}

export function registerGmailPubSubWebhook(app: Express): void {
  app.post(GMAIL_PUBSUB_WEBHOOK_PATH, (req: Request, res: Response) => {
    void handleGmailPubSub(req, res);
  });
}
