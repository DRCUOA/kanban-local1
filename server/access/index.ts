import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { accessDevices, type AccessDevice } from '@shared/schema';
import {
  ACCESS_REQUIRED,
  ACCESS_TRUST_DAYS,
  DEVELOPER_SECRET_HEADER,
  type AccessStatus,
  type ConsoleDevice,
} from '@shared/access';
import { logger } from '@shared/logger';
import { db } from '../db';
import {
  BROWSER_KEY_FORM,
  findByDigest,
  hashAccessCode,
  hashBrowserKey,
  hashExportToken,
  newAccessCode,
  newSecretToken,
  sameDigest,
  secretMatches,
} from './keys';

/**
 * Access control, replicating stageboard-pilot's access codes and developer
 * console (its architecture §7), without its parties and idle sign-out, which
 * exist there for a two-party client pilot.
 *
 *  - Every browser gets a key: 256 random bits in an HttpOnly, SameSite=Lax
 *    cookie (Secure in production) that script cannot read.
 *  - A person is admitted by typing an access code once per browser. The code
 *    binds to the first browser that uses it, and that browser is trusted for
 *    90 days from admission; typing it again renews. An unknown, revoked or
 *    other-browser code gets one and the same answer.
 *  - Every /api request needs an admitted, unrevoked, in-date browser, except
 *    the health check, the access endpoints themselves, the Gmail webhook
 *    (Google signs it; it has its own check) and GET /api/export with a live
 *    read-only export token (the briefing agent has no browser).
 *  - A change from another site is refused before it is read.
 *  - The developer console (/console/api) issues codes and export tokens and
 *    revokes them. It answers only with DEVELOPER_SECRET in a header, compared
 *    in constant time; with any other it answers exactly like an address that
 *    does not exist.
 *  - Codes and tokens are shown once and stored only as HMAC digests under
 *    CODE_HASH_KEY.
 */

export interface AccessConfig {
  hashKey: string;
  developerSecret: string | null;
  secureCookies: boolean;
  trustDays: number;
}

/**
 * From the environment. Production fails closed: without CODE_HASH_KEY and
 * DEVELOPER_SECRET the server refuses to start rather than run open (or run
 * with no way to issue a code). Elsewhere, no CODE_HASH_KEY means no gate.
 */
/**
 * What is wrong with one required setting, in words that say which case it
 * is (never the value): missing, empty after trimming, or set but too short.
 * Null when it is fine.
 */
export function describeSetting(name: string, raw: string | undefined, min: number): string | null {
  if (raw === undefined) return `${name} is not set`;
  const length = raw.trim().length;
  if (length === 0) return `${name} is set but empty (${raw.length} characters, all spaces)`;
  if (length < min) {
    return `${name} is set but ${length} characters long after trimming spaces; it needs ${min} or more`;
  }
  return null;
}

export function accessConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AccessConfig | null {
  const production = env.NODE_ENV === 'production';
  const hashKey = env.CODE_HASH_KEY?.trim() ?? '';
  const developerSecret = env.DEVELOPER_SECRET?.trim() ?? '';
  if (production) {
    const problems = [
      describeSetting('CODE_HASH_KEY', env.CODE_HASH_KEY, 32),
      describeSetting('DEVELOPER_SECRET', env.DEVELOPER_SECRET, 16),
    ].filter((p): p is string => p !== null);
    if (problems.length > 0) {
      throw new Error(`Access control will not start open in production: ${problems.join('; ')}.`);
    }
  }
  if (hashKey === '') return null;
  return {
    hashKey,
    developerSecret: developerSecret === '' ? null : developerSecret,
    secureCookies: production,
    trustDays: ACCESS_TRUST_DAYS,
  };
}

// ------------------------------------------------------------------ store

export interface AccessStore {
  all(): Promise<AccessDevice[]>;
  /** The newest live device bound to this browser key digest. */
  byBrowserKey(digest: string): Promise<AccessDevice | undefined>;
  admit(id: number, browserKeyHash: string, at: Date): Promise<void>;
  touch(id: number, at: Date): Promise<void>;
  insert(row: {
    kind: 'device' | 'export-token';
    label: string;
    codeHash: string;
    at: Date;
  }): Promise<boolean>;
  revoke(id: number, at: Date): Promise<AccessDevice | undefined>;
}

export const databaseAccessStore: AccessStore = {
  all: () => db.select().from(accessDevices),
  async byBrowserKey(digest) {
    const [row] = await db
      .select()
      .from(accessDevices)
      .where(and(eq(accessDevices.browserKeyHash, digest), isNull(accessDevices.revokedAt)))
      .orderBy(desc(accessDevices.admittedAt))
      .limit(1);
    return row;
  },
  async admit(id, browserKeyHash, at) {
    const [row] = await db.select().from(accessDevices).where(eq(accessDevices.id, id));
    await db
      .update(accessDevices)
      .set({
        browserKeyHash: row?.browserKeyHash ?? browserKeyHash,
        admittedAt: at,
        firstSeenAt: row?.firstSeenAt ?? at,
        lastSeenAt: at,
      })
      .where(eq(accessDevices.id, id));
  },
  async touch(id, at) {
    await db.update(accessDevices).set({ lastSeenAt: at }).where(eq(accessDevices.id, id));
  },
  async insert({ kind, label, codeHash, at }) {
    const rows = await db
      .insert(accessDevices)
      .values({ kind, label, codeHash, issuedAt: at })
      .onConflictDoNothing()
      .returning({ id: accessDevices.id });
    return rows.length === 1;
  },
  async revoke(id, at) {
    const [row] = await db.select().from(accessDevices).where(eq(accessDevices.id, id));
    if (!row) return undefined;
    if (row.revokedAt === null) {
      await db.update(accessDevices).set({ revokedAt: at }).where(eq(accessDevices.id, id));
    }
    return row;
  },
};

// ------------------------------------------------------------------ helpers

export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    const name = part.slice(0, at).trim();
    if (!cookies.has(name)) cookies.set(name, part.slice(at + 1).trim());
  }
  return cookies;
}

/** Does the browser say this request came from another site or origin? Script cannot forge these headers. */
export function fromAnotherSite(req: Request): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

const TOUCH_EVERY_MS = 5 * 60_000;
const COOKIE_MAX_AGE_SECONDS = 400 * 86_400;
const notFound = (res: Response) => res.status(404).json({ error: 'Not found', status: 404 });

// ------------------------------------------------------------------ the gate

export interface Access {
  /** Mount first: gives every browser its key. */
  browserKey: RequestHandler;
  /** Mount at /api, ahead of every route. */
  guard: RequestHandler;
  /** GET /api/access/status and POST /api/access/admit. */
  routes: Router;
  /** The developer console's data interface, at /console/api. */
  console: Router;
}

export function createAccess(options: {
  config: AccessConfig;
  store: AccessStore;
  now?: () => Date;
  /** /api paths that keep their own guard. */
  openPaths?: string[];
}): Access {
  const { config, store } = options;
  const now = options.now ?? (() => new Date());
  const cookieName = config.secureCookies ? '__Host-kb_key' : 'kb_key';
  const trustMs = config.trustDays * 86_400_000;
  const openPaths = new Set([
    '/api/health',
    '/api/access/status',
    '/api/access/admit',
    ...(options.openPaths ?? []),
  ]);

  const keyOf = (req: Request): string | null => {
    const held = parseCookies(req.headers.cookie).get(cookieName);
    const parts = held === undefined ? null : BROWSER_KEY_FORM.exec(held);
    return parts?.[1] ?? null;
  };

  /** The admitted, unrevoked, in-date device this request's browser acts for, if any. */
  async function deviceOf(req: Request): Promise<AccessDevice | null> {
    const key = (req.res?.locals.browserKey as string | undefined) ?? keyOf(req);
    if (!key) return null;
    const device = await store.byBrowserKey(hashBrowserKey(config.hashKey, key));
    if (device?.kind !== 'device' || !device.admittedAt) return null;
    return now().getTime() < device.admittedAt.getTime() + trustMs ? device : null;
  }

  const browserKey: RequestHandler = (req, res, next) => {
    // Never set for a request from another site: a page there could otherwise
    // make this browser take a key it never asked for.
    if (fromAnotherSite(req)) {
      next();
      return;
    }
    const held = parseCookies(req.headers.cookie).get(cookieName);
    const parts = held === undefined ? null : BROWSER_KEY_FORM.exec(held);
    const today = now().toISOString().slice(0, 10);
    if (parts?.[1]) {
      res.locals.browserKey = parts[1];
      // Re-set at most daily, on a read, so a browser in use keeps it indefinitely.
      if (parts[2] === today || !(req.method === 'GET' || req.method === 'HEAD')) {
        next();
        return;
      }
    }
    const key = parts?.[1] ?? newSecretToken();
    res.locals.browserKey = key;
    const secure = config.secureCookies ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      `${cookieName}=${key}.${today}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    next();
  };

  const guard: RequestHandler = (req, res, next) => {
    const path = req.baseUrl + req.path;
    const write = !(req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS');
    if (write && fromAnotherSite(req)) {
      res.status(403).json({ error: 'Cross-site request refused', status: 403 });
      return;
    }
    if (openPaths.has(path)) {
      next();
      return;
    }
    void (async () => {
      // The briefing agent: a read-only token, and only for the export.
      const auth = req.headers.authorization;
      if (req.method === 'GET' && path === '/api/export' && auth?.startsWith('Bearer ')) {
        const digest = hashExportToken(config.hashKey, auth.slice(7));
        const token = findByDigest(await store.all(), digest);
        if (token?.kind === 'export-token' && token.revokedAt === null) {
          if (!token.lastSeenAt || now().getTime() - token.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
            await store.touch(token.id, now());
          }
          next();
          return;
        }
      }
      const device = await deviceOf(req);
      if (!device) {
        res
          .status(401)
          .set('Cache-Control', 'no-store')
          .json({ error: ACCESS_REQUIRED, status: 401 });
        return;
      }
      if (!device.lastSeenAt || now().getTime() - device.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
        await store.touch(device.id, now());
      }
      next();
    })().catch(next);
  };

  // ---------------------------------------------------------------- welcome

  const routes = Router();
  const admitLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Wait 15 minutes and try again.', status: 429 },
  });

  routes.get('/api/access/status', (req, res, next) => {
    deviceOf(req)
      .then((device) => {
        res
          .set('Cache-Control', 'no-store')
          .json({ enabled: true, admitted: device !== null } satisfies AccessStatus);
      })
      .catch(next);
  });

  routes.post('/api/access/admit', admitLimit, (req, res, next) => {
    void (async () => {
      const body = z.object({ code: z.string().max(100) }).safeParse(req.body);
      const key = res.locals.browserKey as string | undefined;
      const refuse = () => res.status(403).json({ error: 'That code is not valid.', status: 403 });
      if (!body.success || !key) {
        refuse();
        return;
      }
      const keyHash = hashBrowserKey(config.hashKey, key);
      const found = findByDigest(await store.all(), hashAccessCode(config.hashKey, body.data.code));
      const sameBrowser =
        found?.browserKeyHash == null || sameDigest(found.browserKeyHash, keyHash);
      // One answer for unknown, revoked, token-not-code and another browser's code.
      if (found?.kind !== 'device' || found.revokedAt !== null || !sameBrowser) {
        logger.warn('access: code refused', { ip: req.ip });
        refuse();
        return;
      }
      await store.admit(found.id, keyHash, now());
      logger.info('access: device admitted', { id: found.id, label: found.label });
      res.json({ enabled: true, admitted: true } satisfies AccessStatus);
    })().catch(next);
  });

  // ---------------------------------------------------------------- console

  const consoleRouter = Router();
  // Counted before the secret is checked, so guessing it is slow too.
  consoleRouter.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 60,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  consoleRouter.use((req, res, next) => {
    if (!secretMatches(config.developerSecret, req.headers[DEVELOPER_SECRET_HEADER])) {
      // The same answer as an address that does not exist (below).
      notFound(res);
      return;
    }
    if (fromAnotherSite(req)) {
      notFound(res);
      return;
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  consoleRouter.use(express.json({ limit: '10kb' }));

  const toConsole = (row: AccessDevice): ConsoleDevice => ({
    id: row.id,
    kind: row.kind === 'export-token' ? 'export-token' : 'device',
    label: row.label,
    status: row.revokedAt
      ? 'revoked'
      : row.kind === 'device' && !row.admittedAt
        ? 'not-used'
        : 'live',
    issuedAt: row.issuedAt.toISOString(),
    admittedAt: row.admittedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    trustedUntil:
      row.kind === 'device' && row.admittedAt
        ? new Date(row.admittedAt.getTime() + trustMs).toISOString()
        : null,
  });

  consoleRouter.get('/devices', (_req, res, next) => {
    store
      .all()
      .then((rows) => {
        rows.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime() || b.id - a.id);
        res.json({ devices: rows.map(toConsole), trustDays: config.trustDays });
      })
      .catch(next);
  });

  const labelOf = (body: unknown): string | null => {
    const parsed = z.object({ label: z.string() }).safeParse(body);
    const label = parsed.success ? parsed.data.label.trim() : '';
    // Counted as code points, as the database counts characters.
    const length = Array.from(label).length;
    return length >= 1 && length <= 60 ? label : null;
  };

  const issue =
    (kind: 'device' | 'export-token') =>
    (req: Request, res: Response, next: (e?: unknown) => void) => {
      void (async () => {
        const label = labelOf(req.body);
        if (!label) {
          res.status(422).json({ error: 'Give it a label of 1 to 60 characters.', status: 422 });
          return;
        }
        for (let draw = 0; draw < 5; draw++) {
          const secret = kind === 'device' ? newAccessCode() : newSecretToken('kbx_');
          const codeHash =
            kind === 'device'
              ? hashAccessCode(config.hashKey, secret)
              : hashExportToken(config.hashKey, secret);
          if (await store.insert({ kind, label, codeHash, at: now() })) {
            logger.info(`access: ${kind} issued`, { label });
            // Shown once: only its digest is kept.
            res.status(201).json(kind === 'device' ? { code: secret } : { token: secret });
            return;
          }
        }
        throw new Error('Five drawn codes were all already held.');
      })().catch(next);
    };
  consoleRouter.post('/devices', issue('device'));
  consoleRouter.post('/tokens', issue('export-token'));

  consoleRouter.post('/devices/:id/revoke', (req, res, next) => {
    void (async () => {
      if ((req.body as { confirm?: unknown } | undefined)?.confirm !== true) {
        res.status(422).json({ error: 'Confirm to revoke.', status: 422 });
        return;
      }
      const id = Number(req.params.id);
      const row = Number.isInteger(id) ? await store.revoke(id, now()) : undefined;
      if (!row) {
        res.status(422).json({ error: 'No such device.', status: 422 });
        return;
      }
      logger.info('access: revoked', { id, label: row.label });
      res.json({ revoked: true, label: row.label });
    })().catch(next);
  });
  consoleRouter.use((_req, res) => {
    notFound(res);
  });

  return { browserKey, guard, routes, console: consoleRouter };
}

/** Mounts access on the app when configured; reports whether it did. */
export function installAccess(app: express.Express, openPaths: string[]): boolean {
  const config = accessConfigFromEnv();
  if (!config) {
    logger.warn('Access control is OFF (no CODE_HASH_KEY). Fine for local development only.');
    app.get('/api/access/status', (_req, res) => {
      res.json({ enabled: false, admitted: true } satisfies AccessStatus);
    });
    return false;
  }
  const access = createAccess({ config, store: databaseAccessStore, openPaths });
  app.use('/console/api', access.console);
  app.use(access.browserKey);
  app.use(access.routes);
  app.use('/api', access.guard);
  if (!config.developerSecret)
    logger.warn('Access control is on but the developer console is closed (no DEVELOPER_SECRET).');
  return true;
}
