import { createHash } from 'node:crypto';

/** Minimal quoted-reply stripping (v1). */
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^>\s?/.test(line)) break;
    if (/^On .+ wrote:$/i.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

export function hashBody(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface NormalizedEmail {
  subject: string;
  plainBody: string;
  snippetFallback: string;
}

/** Prefer text/plain; multipart first plain; else snippet. */
export function normalizeGmailMessageParts(
  payload:
    | {
        mimeType?: string | null;
        body?: { data?: string | null } | null;
        parts?: {
          mimeType?: string | null;
          body?: { data?: string | null } | null;
          parts?: unknown[];
        }[];
        filename?: string | null;
      }
    | null
    | undefined,
  snippet: string,
): NormalizedEmail {
  const subject = '';
  const decode = (b64?: string | null) => {
    if (!b64) return '';
    const buf = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return buf.toString('utf8');
  };

  function findPlain(p: typeof payload): string {
    if (!p) return '';
    if (p.mimeType === 'text/plain' && p.body?.data) return decode(p.body.data);
    if (p.parts) {
      for (const part of p.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
        const nested = part as { parts?: typeof p.parts };
        if (nested.parts) {
          const inner = findPlain({
            parts: nested.parts,
            mimeType: part.mimeType,
            body: part.body,
          });
          if (inner) return inner;
        }
      }
    }
    return '';
  }

  const plain = findPlain(payload).trim();
  const rawBody = plain || snippet || '';
  const plainBody = stripQuotedReply(rawBody);
  return {
    subject,
    plainBody,
    snippetFallback: snippet || '',
  };
}
