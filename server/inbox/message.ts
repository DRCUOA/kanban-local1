import { createHash } from 'node:crypto';
import { simpleParser, type AddressObject } from 'mailparser';
import { inboxJsonSchema } from '@shared/inbox';
import { stripQuotedReply } from '../gmail/normalize-email';

/**
 * One message for the board, whatever carried it here: the three bodies the
 * inbox takes all become this before anything else looks at them.
 */
export interface InboxMessage {
  /** Empty when the message has none; the extraction then titles the task from the body. */
  subject: string;
  /** The plain-text body, empty when there is none. HTML-only mail is converted on parsing. */
  text: string;
  /** The sender's address alone, lower-cased, or null when nothing said who sent it. */
  sender: string | null;
  recipient: string | null;
  /** The RFC Message-ID without its angle brackets, or null. */
  rfcMessageId: string | null;
}

/** A body the inbox cannot take as a message; its text is for the client. */
export class InboxMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InboxMessageError';
  }
}

/** `Rich <rich@example.com>`, `<rich@example.com>` or `rich@example.com` → `rich@example.com`. */
export function addressOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const angled = /<([^<>\s]+@[^<>\s]+)>/.exec(raw);
  const bare = /([^\s<>"',;]+@[^\s<>"',;]+)/.exec(raw);
  const address = angled?.[1] ?? bare?.[1] ?? null;
  return address ? address.toLowerCase() : null;
}

/** An RFC Message-ID as stored: trimmed, without the angle brackets, or null when blank. */
export function normalizeMessageId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  const inner = trimmed.replace(/^<+/, '').replace(/>+$/, '').trim();
  return inner === '' ? null : inner;
}

function tidy(text: string | null | undefined): string {
  return (text ?? '').replace(/\r\n/g, '\n').trim();
}

/** The JSON body (shared/inbox.ts). */
export function fromJson(body: unknown): InboxMessage {
  const parsed = inboxJsonSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new InboxMessageError(`${where}${first?.message ?? 'Invalid message.'}`);
  }
  const m = parsed.data;
  return {
    subject: tidy(m.subject),
    text: tidy(m.text),
    sender: addressOf(m.from),
    recipient: addressOf(m.to),
    rfcMessageId: normalizeMessageId(m.messageId),
  };
}

/** A plain-text note: the first non-empty line is the subject, what follows the body. */
export function fromText(raw: string): InboxMessage {
  const lines = tidy(raw).split('\n');
  const firstIndex = lines.findIndex((line) => line.trim() !== '');
  if (firstIndex === -1) throw new InboxMessageError('The message is empty.');
  const subject = (lines[firstIndex] ?? '').trim();
  const text = lines
    .slice(firstIndex + 1)
    .join('\n')
    .trim();
  return { subject, text, sender: null, recipient: null, rfcMessageId: null };
}

function firstAddress(value: AddressObject | AddressObject[] | undefined): string | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  for (const group of list) {
    for (const entry of group.value) {
      const address = addressOf(entry.address);
      if (address) return address;
    }
  }
  return null;
}

/**
 * The raw email (`message/rfc822`). Only the headers and the text body are
 * kept, with any quoted reply under it cut off, as an email is the one body
 * that carries one; attachments are not kept.
 */
export async function fromRfc822(raw: Buffer): Promise<InboxMessage> {
  if (raw.length === 0) throw new InboxMessageError('The message is empty.');
  const mail = await simpleParser(raw, { skipImageLinks: true, skipTextLinks: true });
  const subject = tidy(mail.subject);
  const text = stripQuotedReply(tidy(mail.text));
  if (subject === '' && text === '') {
    throw new InboxMessageError('The message has no subject and no text.');
  }
  return {
    subject,
    text,
    sender: firstAddress(mail.from),
    recipient: firstAddress(mail.to),
    rfcMessageId: normalizeMessageId(mail.messageId),
  };
}

/**
 * What makes a redelivery of the same message a no-op. Forwarders deliver at
 * least once, so the queue keys each inbox row by the message's own id when
 * it has one, else by a digest of who sent what.
 */
export function messageKeyOf(message: InboxMessage): string {
  if (message.rfcMessageId) return `mid:${message.rfcMessageId}`;
  const digest = createHash('sha256')
    .update(`${message.sender ?? ''}\n${message.subject}\n${message.text}`, 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

/**
 * `INBOX_ALLOWED_SENDERS`: addresses and domains, separated by commas or
 * spaces, in any case. `@example.com` or `example.com` is the whole domain.
 */
export function parseAllowedSenders(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
}

/**
 * The token on the request is what admits a message; this list is a second
 * gate for mail, whose From is anyone's to forge. An empty list allows every
 * sender, and a message that names no sender at all is allowed on the token
 * alone.
 */
export function senderAllowed(sender: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0 || sender === null) return true;
  const address = sender.toLowerCase();
  const domain = address.slice(address.lastIndexOf('@') + 1);
  return allowed.some((entry) => {
    if (entry.startsWith('@')) return domain === entry.slice(1);
    if (entry.includes('@')) return address === entry;
    return domain === entry;
  });
}
