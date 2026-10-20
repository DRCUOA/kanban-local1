/**
 * The provider tag of a queue row that arrived through `POST /api/inbox`, as
 * opposed to one the Gmail pipeline found. The worker reads the message from
 * the row itself for these; there is nowhere else to fetch it from.
 */
export const PROVIDER_INBOX = 'inbox' as const;
