import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  addressOf,
  fromJson,
  fromRfc822,
  fromText,
  InboxMessageError,
  messageKeyOf,
  normalizeMessageId,
  parseAllowedSenders,
  senderAllowed,
} from './message';

const raw = (lines: string[]) => Buffer.from(lines.join('\r\n'), 'utf8');

describe('addressOf', () => {
  it('takes the address out of a display-name form and lower-cases it', () => {
    expect(addressOf('Rich Clark <Rich@Example.com>')).toBe('rich@example.com');
    expect(addressOf('<rich@example.com>')).toBe('rich@example.com');
    expect(addressOf('  rich@example.com ')).toBe('rich@example.com');
    expect(addressOf('nobody here')).toBeNull();
    expect(addressOf(undefined)).toBeNull();
  });
});

describe('normalizeMessageId', () => {
  it('drops the angle brackets and blank ids', () => {
    expect(normalizeMessageId('<abc@mail.example>')).toBe('abc@mail.example');
    expect(normalizeMessageId(' abc@mail.example ')).toBe('abc@mail.example');
    expect(normalizeMessageId('<>')).toBeNull();
    expect(normalizeMessageId(null)).toBeNull();
  });
});

describe('fromJson', () => {
  it('tidies the fields and reads the addresses', () => {
    expect(
      fromJson({
        subject: '  Book the dentist ',
        text: 'Soon.\r\nReally.',
        from: 'Rich <rich@example.com>',
        to: 'board@kanban.example',
        messageId: '<id-1@x>',
      }),
    ).toEqual({
      subject: 'Book the dentist',
      text: 'Soon.\nReally.',
      sender: 'rich@example.com',
      recipient: 'board@kanban.example',
      rfcMessageId: 'id-1@x',
    });
  });

  it('needs a subject or some text, and says so', () => {
    expect(() => fromJson({})).toThrow(InboxMessageError);
    expect(() => fromJson({ subject: '  ', text: '' })).toThrow('Give the message a subject');
    expect(() => fromJson({ subject: 5 })).toThrow(/^subject: /);
    expect(fromJson({ text: 'just a note' }).subject).toBe('');
  });
});

describe('fromText', () => {
  it('reads the first line as the subject and the rest as the body', () => {
    expect(fromText('\n\nFix the gate\nIt sticks in the wet.\n\nBadly.\n')).toEqual({
      subject: 'Fix the gate',
      text: 'It sticks in the wet.\n\nBadly.',
      sender: null,
      recipient: null,
      rfcMessageId: null,
    });
    expect(fromText('Just a title').text).toBe('');
    expect(() => fromText('  \n ')).toThrow('The message is empty.');
  });
});

describe('fromRfc822', () => {
  it('reads the headers and the text, and cuts off the quoted reply', async () => {
    const message = await fromRfc822(
      raw([
        'From: Rich Clark <Rich@Example.com>',
        'To: Board <board@kanban.example>',
        'Subject: Send the care plan SOW !high',
        'Message-ID: <abc123@mail.example.com>',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'With a short covering note.',
        '',
        'On Mon, 20 Oct 2026, Amber wrote:',
        '> Could you send it over?',
      ]),
    );
    expect(message).toEqual({
      subject: 'Send the care plan SOW !high',
      text: 'With a short covering note.',
      sender: 'rich@example.com',
      recipient: 'board@kanban.example',
      rfcMessageId: 'abc123@mail.example.com',
    });
  });

  it('reads an HTML-only mail as text', async () => {
    const message = await fromRfc822(
      raw([
        'From: a@b.example',
        'Subject: Hello',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>Hello <b>there</b></p>',
      ]),
    );
    expect(message.text).toBe('Hello there');
    expect(message.rfcMessageId).toBeNull();
  });

  it('refuses an empty body and a mail with neither subject nor text', async () => {
    await expect(fromRfc822(Buffer.alloc(0))).rejects.toThrow('The message is empty.');
    await expect(fromRfc822(raw(['From: a@b.example', '', '']))).rejects.toThrow(
      'no subject and no text',
    );
  });
});

describe('messageKeyOf', () => {
  it('is the Message-ID when there is one, else a digest of who sent what', () => {
    const base = { subject: 'Fix the gate', text: 'It sticks.', sender: null, recipient: null };
    expect(messageKeyOf({ ...base, rfcMessageId: 'abc@x' })).toBe('mid:abc@x');
    const digest = createHash('sha256').update('\nFix the gate\nIt sticks.', 'utf8').digest('hex');
    expect(messageKeyOf({ ...base, rfcMessageId: null })).toBe(`sha256:${digest}`);
    expect(messageKeyOf({ ...base, rfcMessageId: null, sender: 'a@b.example' })).not.toBe(
      `sha256:${digest}`,
    );
  });
});

describe('the allowed-senders list', () => {
  it('is addresses and domains, separated by commas or spaces, in any case', () => {
    expect(parseAllowedSenders(' Rich@Example.com, @work.test  other.test;x@y.test ')).toEqual([
      'rich@example.com',
      '@work.test',
      'other.test',
      'x@y.test',
    ]);
    expect(parseAllowedSenders(undefined)).toEqual([]);
  });

  it('lets a listed address or domain through, nothing else, and everyone when empty', () => {
    const allowed = parseAllowedSenders('rich@example.com, @work.test, other.test');
    expect(senderAllowed('rich@example.com', allowed)).toBe(true);
    expect(senderAllowed('RICH@EXAMPLE.COM', allowed)).toBe(true);
    expect(senderAllowed('anyone@work.test', allowed)).toBe(true);
    expect(senderAllowed('anyone@other.test', allowed)).toBe(true);
    expect(senderAllowed('amber@example.com', allowed)).toBe(false);
    expect(senderAllowed('anyone@notwork.test', allowed)).toBe(false);
    expect(senderAllowed('anyone@evil.test', [])).toBe(true);
    // No sender at all: the token on the request is the whole story.
    expect(senderAllowed(null, allowed)).toBe(true);
  });
});
