import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

/**
 * What access keeps secret and how it compares it (after stageboard-pilot's
 * access-keys.ts). Codes, tokens and browser keys are never stored, only an
 * HMAC-SHA-256 digest under the deployment's CODE_HASH_KEY. A typed code is
 * found by comparing its digest with every stored one in constant time, so
 * how long that takes never depends on how much of a stored digest matched.
 */

type Purpose = 'access-code' | 'browser-key' | 'export-token' | 'inbox-token';

/** Capitals and digits without I, O, 0 and 1: the ones people misread. 5 bits per character. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Typed in lower case, or with spaces around it, it is the same code. */
export function normaliseCode(typed: string): string {
  return typed.trim().toUpperCase();
}

export function keyedDigest(hashKey: string, purpose: Purpose, text: string): string {
  return createHmac('sha256', hashKey).update(`${purpose}\0${text}`).digest('hex');
}

export const hashAccessCode = (hashKey: string, code: string): string =>
  keyedDigest(hashKey, 'access-code', normaliseCode(code));
export const hashBrowserKey = (hashKey: string, key: string): string =>
  keyedDigest(hashKey, 'browser-key', key);
export const hashExportToken = (hashKey: string, token: string): string =>
  keyedDigest(hashKey, 'export-token', token.trim());
/** Its own purpose, so an inbox token's digest can never match an export token's row, or the reverse. */
export const hashInboxToken = (hashKey: string, token: string): string =>
  keyedDigest(hashKey, 'inbox-token', token.trim());

/** Two hex digests, equal or not, in constant time. */
export function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** The row whose digest equals `digest`, comparing every row so the work is the same wherever (or whether) it matches. */
export function findByDigest<T extends { codeHash: string }>(
  rows: readonly T[],
  digest: string,
): T | undefined {
  let found: T | undefined;
  for (const row of rows) {
    if (sameDigest(row.codeHash, digest) && found === undefined) found = row;
  }
  return found;
}

const group = (): string =>
  Array.from({ length: 4 }, () => CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length))).join('');

/** "KB-4K9P-2XQR-7MWD": 60 random bits, easy to read aloud and type on a phone. */
export function newAccessCode(): string {
  return `KB-${group()}-${group()}-${group()}`;
}

/** A browser key, an export token or an inbox token: 256 random bits. */
export function newSecretToken(prefix = ''): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

/** Cookie value: the key and the day it was last set (so it is re-set at most daily). */
export const BROWSER_KEY_FORM = /^([A-Za-z0-9_-]{43})(?:\.(\d{4}-\d{2}-\d{2}))?$/;

/**
 * Is `presented` the configured developer secret? Both sides go through an
 * HMAC under a per-process key first, so the comparison is fixed-length and
 * constant-time whatever was typed, and the same work is done when no secret
 * is configured (then nothing matches).
 */
const COMPARISON_KEY = randomBytes(32);
export function secretMatches(configured: string | null, presented: unknown): boolean {
  const digest = (text: string) => createHmac('sha256', COMPARISON_KEY).update(text).digest();
  const equal = timingSafeEqual(
    digest(configured ?? ''),
    digest(typeof presented === 'string' ? presented : ''),
  );
  return configured !== null && configured !== '' && equal;
}
