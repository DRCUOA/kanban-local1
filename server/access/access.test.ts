/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest bodies are untyped JSON */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'node:http';
import type { AccessDevice } from '@shared/schema';
import { accessConfigFromEnv, createAccess, type AccessStore } from './index';
import { hashAccessCode, newAccessCode, secretMatches, CODE_ALPHABET } from './keys';
import { serveOnLoopback, closeServer } from '../test-support/loopback';

const SECRET = 'developer-secret-for-tests';

function memoryStore(): AccessStore & { rows: AccessDevice[] } {
  const rows: AccessDevice[] = [];
  let seq = 0;
  return {
    rows,
    all: () => Promise.resolve([...rows]),
    byBrowserKey: (digest) =>
      Promise.resolve(
        rows
          .filter((r) => r.browserKeyHash === digest && r.revokedAt === null)
          .sort((a, b) => (b.admittedAt?.getTime() ?? 0) - (a.admittedAt?.getTime() ?? 0))[0],
      ),
    admit: (id, keyHash, at) => {
      const row = rows.find((r) => r.id === id);
      if (row)
        Object.assign(row, {
          browserKeyHash: row.browserKeyHash ?? keyHash,
          admittedAt: at,
          lastSeenAt: at,
        });
      return Promise.resolve();
    },
    touch: (id, at) => {
      const row = rows.find((r) => r.id === id);
      if (row) row.lastSeenAt = at;
      return Promise.resolve();
    },
    insert: ({ kind, label, codeHash, at }) => {
      if (rows.some((r) => r.codeHash === codeHash)) return Promise.resolve(false);
      rows.push({
        id: ++seq,
        kind,
        label,
        codeHash,
        issuedAt: at,
        admittedAt: null,
        browserKeyHash: null,
        firstSeenAt: null,
        lastSeenAt: null,
        revokedAt: null,
      });
      return Promise.resolve(true);
    },
    revoke: (id, at) => {
      const row = rows.find((r) => r.id === id);
      if (row) row.revokedAt ??= at;
      return Promise.resolve(row);
    },
  };
}

let clock = new Date('2026-10-16T00:00:00Z');
let store: ReturnType<typeof memoryStore>;
/** The test app, listening on 127.0.0.1 (see test-support/loopback.ts). */
let app: Server;

beforeEach(async () => {
  clock = new Date('2026-10-16T00:00:00Z');
  store = memoryStore();
  const access = createAccess({
    config: {
      hashKey: 'k'.repeat(40),
      developerSecret: SECRET,
      secureCookies: false,
      trustDays: 90,
    },
    store,
    now: () => clock,
    openPaths: ['/api/webhooks/gmail-pubsub'],
  });
  const handler = express();
  handler.use(express.json());
  handler.use('/console/api', access.console);
  handler.use(access.browserKey);
  handler.use(access.routes);
  handler.use('/api', access.guard);
  handler.get('/api/tasks', (_req, res) => res.json([{ id: 1 }]));
  handler.get('/api/export', (_req, res) => res.json({ ok: true }));
  handler.post('/api/tasks', (_req, res) => res.status(201).json({ id: 2 }));
  handler.get('/api/health', (_req, res) => res.json({ ok: true }));
  handler.post('/api/webhooks/gmail-pubsub', (_req, res) => res.status(204).end());
  handler.post('/api/inbox', (_req, res) => res.status(202).json({ id: 1, duplicate: false }));
  app = await serveOnLoopback(handler);
});

afterEach(() => closeServer(app));

/** A browser: keeps its cookie between requests. */
const browser = () => request.agent(app);
const issueCode = async (label = 'Rich laptop') =>
  (
    await request(app)
      .post('/console/api/devices')
      .set('x-developer-secret', SECRET)
      .send({ label })
  ).body.code as string;

describe('the gate', () => {
  it('refuses data to a browser that has not been admitted, and leaves health and the webhook open', async () => {
    const b = browser();
    expect((await b.get('/api/tasks')).status).toBe(401);
    expect((await b.get('/api/tasks')).body.error).toBe('access-required');
    expect((await b.get('/api/health')).status).toBe(200);
    expect((await request(app).post('/api/webhooks/gmail-pubsub')).status).toBe(204);
  });

  it('gives the browser an HttpOnly key cookie', async () => {
    const res = await request(app).get('/api/access/status');
    expect(res.headers['set-cookie']?.[0]).toMatch(
      /^kb_key=[A-Za-z0-9_-]{43}\.\d{4}-\d{2}-\d{2}; .*HttpOnly; SameSite=Lax/,
    );
  });

  it('admits a browser with a valid code, then serves it', async () => {
    const code = await issueCode();
    const b = browser();
    await b.get('/api/access/status');
    const admit = await b.post('/api/access/admit').send({ code: code.toLowerCase() });
    expect(admit.status).toBe(200);
    expect((await b.get('/api/tasks')).status).toBe(200);
    expect((await b.get('/api/access/status')).body).toEqual({ enabled: true, admitted: true });
  });

  it('gives one answer to an unknown, a revoked and another browser’s code', async () => {
    const code = await issueCode();
    const first = browser();
    await first.get('/api/access/status');
    await first.post('/api/access/admit').send({ code });

    const other = browser();
    await other.get('/api/access/status');
    const stolen = await other.post('/api/access/admit').send({ code });
    const unknown = await other.post('/api/access/admit').send({ code: 'KB-AAAA-BBBB-CCCC' });
    await request(app)
      .post('/console/api/devices/1/revoke')
      .set('x-developer-secret', SECRET)
      .send({ confirm: true });
    const revoked = await first.post('/api/access/admit').send({ code });
    for (const res of [stolen, unknown, revoked]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'That code is not valid.', status: 403 });
    }
    expect((await first.get('/api/tasks')).status).toBe(401);
  });

  it('trusts a browser for 90 days, and a renewed code restarts the clock', async () => {
    const code = await issueCode();
    const b = browser();
    await b.get('/api/access/status');
    await b.post('/api/access/admit').send({ code });
    clock = new Date(clock.getTime() + 89 * 86_400_000);
    expect((await b.get('/api/tasks')).status).toBe(200);
    clock = new Date(clock.getTime() + 2 * 86_400_000);
    expect((await b.get('/api/tasks')).status).toBe(401);
    await b.post('/api/access/admit').send({ code });
    expect((await b.get('/api/tasks')).status).toBe(200);
  });

  it('refuses a change from another site before it is read', async () => {
    const code = await issueCode();
    const b = browser();
    await b.get('/api/access/status');
    await b.post('/api/access/admit').send({ code });
    const res = await b.post('/api/tasks').set('Sec-Fetch-Site', 'cross-site').send({});
    expect(res.status).toBe(403);
  });
});

describe('the export token', () => {
  const issueToken = async () =>
    (
      await request(app)
        .post('/console/api/tokens')
        .set('x-developer-secret', SECRET)
        .send({ label: 'Briefing agent' })
    ).body.token as string;

  it('opens GET /api/export only, until revoked', async () => {
    const token = await issueToken();
    expect(token).toMatch(/^kbx_/);
    const bearer = `Bearer ${token}`;
    expect((await request(app).get('/api/export').set('Authorization', bearer)).status).toBe(200);
    expect((await request(app).get('/api/tasks').set('Authorization', bearer)).status).toBe(401);
    expect(
      (await request(app).get('/api/export').set('Authorization', 'Bearer kbx_wrong')).status,
    ).toBe(401);
    await request(app)
      .post('/console/api/devices/1/revoke')
      .set('x-developer-secret', SECRET)
      .send({ confirm: true });
    expect((await request(app).get('/api/export').set('Authorization', bearer)).status).toBe(401);
  });

  it('is not an access code', async () => {
    const token = await issueToken();
    const b = browser();
    await b.get('/api/access/status');
    expect((await b.post('/api/access/admit').send({ code: token })).status).toBe(403);
  });

  it('does not open the inbox', async () => {
    const bearer = `Bearer ${await issueToken()}`;
    const res = await request(app).post('/api/inbox').set('Authorization', bearer).send({});
    expect(res.status).toBe(401);
  });
});

describe('the inbox token', () => {
  const issueInboxToken = async () =>
    (
      await request(app)
        .post('/console/api/inbox-tokens')
        .set('x-developer-secret', SECRET)
        .send({ label: 'Cloudflare mail' })
    ).body.token as string;

  it('opens POST /api/inbox only, until revoked', async () => {
    const token = await issueInboxToken();
    expect(token).toMatch(/^kbi_/);
    const bearer = `Bearer ${token}`;
    const post = () => request(app).post('/api/inbox').set('Authorization', bearer).send({});
    expect((await post()).status).toBe(202);
    expect((await request(app).get('/api/export').set('Authorization', bearer)).status).toBe(401);
    expect((await request(app).get('/api/tasks').set('Authorization', bearer)).status).toBe(401);
    expect(
      (await request(app).post('/api/tasks').set('Authorization', bearer).send({})).status,
    ).toBe(401);
    expect((await request(app).post('/api/inbox').send({})).status).toBe(401);
    expect(
      (await request(app).post('/api/inbox').set('Authorization', 'Bearer kbi_wrong').send({}))
        .status,
    ).toBe(401);
    await request(app)
      .post('/console/api/devices/1/revoke')
      .set('x-developer-secret', SECRET)
      .send({ confirm: true });
    expect((await post()).status).toBe(401);
  });

  it('is listed by the console as an inbox token, live from the start', async () => {
    await issueInboxToken();
    const list = await request(app).get('/console/api/devices').set('x-developer-secret', SECRET);
    expect(list.body.devices[0]).toMatchObject({
      label: 'Cloudflare mail',
      kind: 'inbox-token',
      status: 'live',
      trustedUntil: null,
    });
  });
});

describe('the developer console', () => {
  it('answers a wrong or missing secret exactly like an address that does not exist', async () => {
    const wrong = await request(app).get('/console/api/devices').set('x-developer-secret', 'nope');
    const none = await request(app).get('/console/api/devices');
    const missing = await request(app)
      .get('/console/api/nothing-here')
      .set('x-developer-secret', SECRET);
    for (const res of [wrong, none, missing]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found', status: 404 });
    }
  });

  it('shows a code once and stores only its digest', async () => {
    const code = await issueCode('Phone');
    expect(code).toMatch(/^KB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(store.rows[0]?.codeHash).toBe(hashAccessCode('k'.repeat(40), code));
    expect(JSON.stringify(store.rows)).not.toContain(code);
    const list = await request(app).get('/console/api/devices').set('x-developer-secret', SECRET);
    expect(JSON.stringify(list.body)).not.toContain(code);
    expect(list.body.devices[0]).toMatchObject({
      label: 'Phone',
      status: 'not-used',
      kind: 'device',
    });
  });

  it('needs a label and a confirmation', async () => {
    const noLabel = await request(app)
      .post('/console/api/devices')
      .set('x-developer-secret', SECRET)
      .send({});
    expect(noLabel.status).toBe(422);
    await issueCode();
    const unconfirmed = await request(app)
      .post('/console/api/devices/1/revoke')
      .set('x-developer-secret', SECRET)
      .send({});
    expect(unconfirmed.status).toBe(422);
    expect(store.rows[0]?.revokedAt).toBeNull();
  });
});

describe('keys and config', () => {
  it('draws codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      for (const ch of newAccessCode().slice(3).replace(/-/g, ''))
        expect(CODE_ALPHABET).toContain(ch);
    }
  });
  it('matches the secret only when one is configured', () => {
    expect(secretMatches('abc', 'abc')).toBe(true);
    expect(secretMatches('abc', 'abd')).toBe(false);
    expect(secretMatches(null, '')).toBe(false);
    expect(secretMatches('abc', undefined)).toBe(false);
  });
  it('refuses to start production without the two settings, and is off locally without them', () => {
    expect(() => accessConfigFromEnv({ NODE_ENV: 'production' })).toThrow(
      'CODE_HASH_KEY is not set; DEVELOPER_SECRET is not set',
    );
    expect(() =>
      accessConfigFromEnv({
        NODE_ENV: 'production',
        CODE_HASH_KEY: 'k'.repeat(20),
        DEVELOPER_SECRET: 's'.repeat(16),
      }),
    ).toThrow(
      'CODE_HASH_KEY is set but 20 characters long after trimming spaces; it needs 32 or more.',
    );
    expect(() =>
      accessConfigFromEnv({
        NODE_ENV: 'production',
        CODE_HASH_KEY: 'k'.repeat(32),
        DEVELOPER_SECRET: '   ',
      }),
    ).toThrow('DEVELOPER_SECRET is set but empty');
    // The message never carries the value.
    try {
      accessConfigFromEnv({
        NODE_ENV: 'production',
        CODE_HASH_KEY: 'shortsecretvalue',
        DEVELOPER_SECRET: 'x',
      });
    } catch (e) {
      expect((e as Error).message).not.toContain('shortsecretvalue');
    }
    expect(accessConfigFromEnv({ NODE_ENV: 'development' })).toBeNull();
    expect(
      accessConfigFromEnv({
        NODE_ENV: 'production',
        CODE_HASH_KEY: 'k'.repeat(32),
        DEVELOPER_SECRET: 's'.repeat(16),
      }),
    ).toMatchObject({ secureCookies: true, trustDays: 90 });
  });
});
