import { describe, expect, it } from 'vitest';
import { normalizeGmailMessageParts, stripQuotedReply } from './normalize-email';

describe('stripQuotedReply', () => {
  it('stops at quoted lines', () => {
    expect(stripQuotedReply('Hello\n> quoted')).toBe('Hello');
  });
});

describe('normalizeGmailMessageParts', () => {
  it('prefers text/plain over snippet', () => {
    const out = normalizeGmailMessageParts(
      {
        mimeType: 'text/plain',
        body: { data: Buffer.from('plain body', 'utf8').toString('base64') },
      },
      'snippet text',
    );
    expect(out.plainBody).toContain('plain body');
  });

  it('falls back to snippet when no plain body', () => {
    const out = normalizeGmailMessageParts({ mimeType: 'text/html', body: {} }, 'only snippet');
    expect(out.plainBody).toBe('only snippet');
  });
});
