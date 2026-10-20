/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- supertest bodies are untyped JSON */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockEnqueue = vi.hoisted(() => vi.fn());
vi.mock('../inbound-email/repository', () => ({ enqueueInboundMessage: mockEnqueue }));

import { errorHandler } from '../errors';
import { registerInboxRoute } from './route';

/** The route as the server mounts it: after the JSON parser, before the error handler. */
function inboxApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  registerInboxRoute(app);
  app.use(errorHandler);
  return app;
}

const RAW_EMAIL = [
  'From: Rich Clark <Rich@Example.com>',
  'To: board@kanban.example',
  'Subject: Send the care plan SOW !high',
  'Message-ID: <abc123@mail.example.com>',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'With a short covering note.',
  '',
  'On Mon, 20 Oct 2026, Amber wrote:',
  '> Could you send it over?',
].join('\r\n');

beforeEach(() => {
  mockEnqueue.mockReset();
  mockEnqueue.mockResolvedValue({ id: 7, duplicate: false });
  delete process.env.INBOX_ALLOWED_SENDERS;
});

describe('POST /api/inbox', () => {
  it('queues a JSON message and answers 202 with its row', async () => {
    const res = await request(inboxApp()).post('/api/inbox').send({
      subject: 'Book the dentist',
      text: 'Soon.',
      from: 'Rich <rich@example.com>',
      messageId: '<id-1@x>',
    });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ id: 7, duplicate: false });
    expect(mockEnqueue).toHaveBeenCalledWith({
      subject: 'Book the dentist',
      text: 'Soon.',
      sender: 'rich@example.com',
      recipient: null,
      rfcMessageId: 'id-1@x',
      messageKey: 'mid:id-1@x',
    });
  });

  it('takes a plain-text note: the first line is the subject, keyed by a digest', async () => {
    const res = await request(inboxApp())
      .post('/api/inbox')
      .set('Content-Type', 'text/plain')
      .send('Fix the gate\nIt sticks.');
    expect(res.status).toBe(202);
    const digest = createHash('sha256').update('\nFix the gate\nIt sticks.', 'utf8').digest('hex');
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Fix the gate',
        text: 'It sticks.',
        sender: null,
        messageKey: `sha256:${digest}`,
      }),
    );
  });

  it('parses a raw email: headers, text without the quoted reply, keyed by its Message-ID', async () => {
    const res = await request(inboxApp())
      .post('/api/inbox')
      .set('Content-Type', 'message/rfc822')
      .send(RAW_EMAIL);
    expect(res.status).toBe(202);
    expect(mockEnqueue).toHaveBeenCalledWith({
      subject: 'Send the care plan SOW !high',
      text: 'With a short covering note.',
      sender: 'rich@example.com',
      recipient: 'board@kanban.example',
      rfcMessageId: 'abc123@mail.example.com',
      messageKey: 'mid:abc123@mail.example.com',
    });
  });

  it('answers a redelivery with the row it already has', async () => {
    mockEnqueue.mockResolvedValue({ id: 7, duplicate: true });
    const res = await request(inboxApp()).post('/api/inbox').send({ subject: 'Again' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ id: 7, duplicate: true });
  });

  it('refuses an empty message, a missing body and a body type it does not take', async () => {
    const empty = await request(inboxApp()).post('/api/inbox').send({ subject: ' ' });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toContain('subject or some text');

    const missing = await request(inboxApp()).post('/api/inbox');
    expect(missing.status).toBe(400);
    expect(missing.body.error).toContain('empty');

    const xml = await request(inboxApp())
      .post('/api/inbox')
      .set('Content-Type', 'application/xml')
      .send('<task/>');
    expect(xml.status).toBe(415);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('refuses a sender outside INBOX_ALLOWED_SENDERS and lets one inside, or none, through', async () => {
    process.env.INBOX_ALLOWED_SENDERS = 'example.com, boss@work.test';
    const refused = await request(inboxApp())
      .post('/api/inbox')
      .send({ subject: 'Buy now', from: 'spam@evil.test' });
    expect(refused.status).toBe(403);
    expect(mockEnqueue).not.toHaveBeenCalled();

    const byDomain = await request(inboxApp())
      .post('/api/inbox')
      .send({ subject: 'Fine', from: 'Rich <rich@example.com>' });
    expect(byDomain.status).toBe(202);

    const raw = await request(inboxApp())
      .post('/api/inbox')
      .set('Content-Type', 'message/rfc822')
      .send(RAW_EMAIL.replace('Rich@Example.com', 'someone@elsewhere.test'));
    expect(raw.status).toBe(403);

    const noSender = await request(inboxApp())
      .post('/api/inbox')
      .send({ subject: 'From a script' });
    expect(noSender.status).toBe(202);
  });
});
