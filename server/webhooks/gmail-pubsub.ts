import type { Express, Request, Response } from 'express';
import { verifyPubSubPushJwt } from '../gmail/pubsub-verify';
import { syncAfterPubSubNotification } from '../gmail/history-sync';
import { logger } from '@shared/logger';

export const GMAIL_PUBSUB_WEBHOOK_PATH = '/api/webhooks/gmail-pubsub';

async function handleGmailPubSub(req: Request, res: Response): Promise<void> {
  try {
    const audience = process.env.GMAIL_PUBSUB_AUDIENCE;
    if (!audience) {
      throw new Error('GMAIL_PUBSUB_AUDIENCE must be set to the push endpoint URL (OIDC audience)');
    }
    await verifyPubSubPushJwt(req.get('Authorization'), audience);
    const body = req.body as { message?: { data?: string } };
    const raw = body.message?.data;
    if (!raw) {
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
      res.status(400).send('invalid notification payload');
      return;
    }
    const labelId = process.env.GMAIL_LABEL_ID;
    if (!labelId) {
      throw new Error('GMAIL_LABEL_ID is required');
    }
    await syncAfterPubSubNotification({ mailbox, notificationHistoryId: historyId, labelId });
    res.status(204).end();
  } catch (e) {
    logger.error('gmail pubsub webhook error', e);
    res.status(500).send('internal error');
  }
}

export function registerGmailPubSubWebhook(app: Express): void {
  app.post(GMAIL_PUBSUB_WEBHOOK_PATH, (req: Request, res: Response) => {
    void handleGmailPubSub(req, res);
  });
}
