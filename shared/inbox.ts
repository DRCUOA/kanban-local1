import { z } from 'zod';

/**
 * The inbox: `POST /api/inbox`, where mail for the board arrives from whatever
 * receives it for the domain (a Cloudflare email worker, an inbound-parse
 * service, a script). The board owns this contract, so the thing that
 * forwards mail is a dumb adapter that any other can replace; nothing here
 * depends on a mail provider's API. See INBOX_SETUP.md.
 *
 * Three bodies are taken, by `Content-Type`:
 *  - `message/rfc822`: the raw email, parsed on the server.
 *  - `text/plain`: a note; its first line is the subject, the rest the body.
 *  - `application/json`: `inboxJsonSchema` below, for anything that is not an
 *    email at all (a phone shortcut, a script, an import).
 */

/** Largest body the inbox takes, a raw email with attachments included: the attachment limit. */
export const INBOX_MAX_BYTES = 10 * 1024 * 1024;

/** How long a subject or an address may be: RFC 5322's line limit, and a generous address. */
const SUBJECT_MAX = 998;
const ADDRESS_MAX = 320;

export const inboxJsonSchema = z
  .object({
    subject: z.string().max(SUBJECT_MAX).optional(),
    text: z.string().max(INBOX_MAX_BYTES).optional(),
    /** The sender, as an address or `Name <address>`; checked against INBOX_ALLOWED_SENDERS when that is set. */
    from: z.string().max(ADDRESS_MAX).optional(),
    to: z.string().max(ADDRESS_MAX).optional(),
    /** Makes a resend of the same message a no-op; an RFC Message-ID or any id of the sender's. */
    messageId: z.string().max(SUBJECT_MAX).optional(),
  })
  .refine((m) => (m.subject?.trim() ?? '') !== '' || (m.text?.trim() ?? '') !== '', {
    message: 'Give the message a subject or some text.',
  });

export type InboxJson = z.infer<typeof inboxJsonSchema>;

/** The inbox's answer: the queue row, and whether this message was already in it. */
export interface InboxReceipt {
  id: number;
  duplicate: boolean;
}
