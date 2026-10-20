import express, { type Express, type Request } from 'express';
import { api } from '@shared/routes';
import { INBOX_MAX_BYTES, type InboxReceipt } from '@shared/inbox';
import { logger } from '@shared/logger';
import { AppError, asyncHandler } from '../errors';
import { enqueueInboundMessage } from '../inbound-email/repository';
import {
  fromJson,
  fromRfc822,
  fromText,
  InboxMessageError,
  messageKeyOf,
  parseAllowedSenders,
  senderAllowed,
  type InboxMessage,
} from './message';

export const INBOX_PATH = api.inbox.ingest.path;

const BODY_TYPES = 'message/rfc822, text/plain or application/json';

async function messageFrom(req: Request): Promise<InboxMessage> {
  // A request that says nothing about its body (no Content-Type, or no body
  // at all) sent nothing: empty, not unsupported.
  const kind = req.headers['content-type']
    ? req.is(['message/rfc822', 'text/plain', 'application/json'])
    : null;
  if (kind === null) throw new AppError(400, `The message is empty. Send it as ${BODY_TYPES}.`);
  if (kind === false) throw new AppError(415, `Send the message as ${BODY_TYPES}.`);
  try {
    if (kind === 'message/rfc822') {
      return await fromRfc822(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    }
    if (kind === 'text/plain') return fromText(typeof req.body === 'string' ? req.body : '');
    return fromJson(req.body);
  } catch (e) {
    if (e instanceof InboxMessageError) throw new AppError(400, e.message);
    throw e;
  }
}

/**
 * `POST /api/inbox`: a message for the board, queued for the inbound worker
 * and acknowledged at once with 202, so a forwarder's timeout never meets the
 * extraction's latency. The access gate opens the route to an inbox token
 * (server/access); INBOX_ALLOWED_SENDERS is a second gate for mail, whose
 * From anyone can forge. A redelivery of the same message (forwarders deliver
 * at least once) answers with the row it already has.
 */
export function registerInboxRoute(app: Express): void {
  app.post(
    INBOX_PATH,
    express.raw({ type: 'message/rfc822', limit: INBOX_MAX_BYTES }),
    express.text({ type: 'text/plain', limit: INBOX_MAX_BYTES }),
    asyncHandler(async (req, res) => {
      const message = await messageFrom(req);
      if (!senderAllowed(message.sender, parseAllowedSenders(process.env.INBOX_ALLOWED_SENDERS))) {
        logger.warn('inbox: sender refused', { sender: message.sender });
        throw new AppError(403, 'That sender is not allowed to post to the inbox.');
      }
      const receipt = await enqueueInboundMessage({
        ...message,
        messageKey: messageKeyOf(message),
      });
      logger.info('inbox: message queued', {
        id: receipt.id,
        duplicate: receipt.duplicate,
        sender: message.sender,
        subject_length: message.subject.length,
        body_length: message.text.length,
      });
      res.status(202).json(receipt satisfies InboxReceipt);
    }),
  );
}
