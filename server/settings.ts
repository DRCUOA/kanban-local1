import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { appSettings } from '@shared/schema';
import {
  CURATED_OPENAI_MODELS,
  DEFAULT_GOAL_PLAN_MODEL,
  isPlanningModel,
  type AiModelOption,
  type AiSettingsResponse,
} from '@shared/goal-plan';
import { logger } from '@shared/logger';
import { db } from './db';

const KEY_MODEL = 'ai.openai_model';
const KEY_API_KEY = 'ai.openai_api_key';
const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';

/**
 * The 32-byte key that encrypts secrets at rest. SETTINGS_SECRET when set;
 * otherwise derived from DATABASE_URL, which every deployment already has and
 * which is not stored in the database, so a dump or backup of the database
 * alone does not reveal the key. Changing whichever is in use makes a saved
 * key unreadable; the Admin page then asks for it again.
 */
function encryptionKey(): { key: Buffer; source: 'settings-secret' | 'database-derived' } {
  const secret = process.env.SETTINGS_SECRET;
  if (secret && secret.length >= 16) {
    return { key: createHash('sha256').update(secret).digest(), source: 'settings-secret' };
  }
  const material = `kanban-settings-v1:${process.env.DATABASE_URL ?? ''}`;
  return { key: createHash('sha256').update(material).digest(), source: 'database-derived' };
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(stored: string, key: Buffer): string | null {
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    return null;
  }
}

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(appSettings).where(eq(appSettings.key, key));
    return;
  }
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

export interface AiConfig {
  model: string;
  apiKey: string | null;
  keySource: AiSettingsResponse['keySource'];
}

/** The model and key the AI assistant uses: the Admin key first, then OPENAI_API_KEY. */
export async function getAiConfig(): Promise<AiConfig> {
  const storedModel = await readSetting(KEY_MODEL);
  // A model saved before the GPT-5+ rule (or retired) falls back to the default.
  const model = storedModel && isPlanningModel(storedModel) ? storedModel : DEFAULT_GOAL_PLAN_MODEL;
  const stored = await readSetting(KEY_API_KEY);
  const adminKey = stored ? decryptSecret(stored, encryptionKey().key) : null;
  if (adminKey) return { model, apiKey: adminKey, keySource: 'admin' };
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return { model, apiKey: envKey, keySource: stored ? 'unreadable' : 'env' };
  return { model, apiKey: null, keySource: stored ? 'unreadable' : 'none' };
}

/** A key or request the user can fix; the route answers 400 with the message. */
export class SettingsRequestError extends Error {}

/**
 * The account's model ids, from OpenAI. Used both to check a key before it is
 * saved (a rejected key is never stored) and to list the models that key can
 * actually call.
 */
async function fetchAccountModels(apiKey: string): Promise<string[]> {
  const res = await fetch(OPENAI_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) throw new SettingsRequestError('OpenAI rejected this API key.');
  if (!res.ok) throw new Error(`OpenAI /v1/models answered ${res.status}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id);
}

let modelCache: { keyHint: string; at: number; ids: string[] } | null = null;
const MODEL_CACHE_MS = 10 * 60_000;

async function modelOptions(
  apiKey: string | null,
): Promise<{ models: AiModelOption[]; source: 'account' | 'curated' }> {
  const curated = CURATED_OPENAI_MODELS.map((m) => ({ id: m.id, note: m.note }));
  if (!apiKey) return { models: curated, source: 'curated' };
  const hint = apiKey.slice(-8);
  try {
    if (modelCache?.keyHint !== hint || Date.now() - modelCache.at > MODEL_CACHE_MS) {
      modelCache = { keyHint: hint, at: Date.now(), ids: await fetchAccountModels(apiKey) };
    }
  } catch (error) {
    logger.warn('Could not list OpenAI models; offering the curated list', error);
    return { models: curated, source: 'curated' };
  }
  const notes = new Map(CURATED_OPENAI_MODELS.map((m, i) => [m.id, { note: m.note, rank: i }]));
  const ids = modelCache.ids.filter(isPlanningModel);
  if (ids.length === 0) return { models: curated, source: 'curated' };
  // Curated (documented) models first in their order, then anything newer the account has.
  ids.sort(
    (a, b) => (notes.get(a)?.rank ?? 1000) - (notes.get(b)?.rank ?? 1000) || b.localeCompare(a),
  );
  return {
    models: ids.map((id) => ({ id, note: notes.get(id)?.note ?? null })),
    source: 'account',
  };
}

export async function getAiSettings(): Promise<AiSettingsResponse> {
  const config = await getAiConfig();
  const { models, source } = await modelOptions(config.apiKey);
  return {
    model: config.model,
    keySource: config.keySource,
    keyHint: config.apiKey ? `…${config.apiKey.slice(-4)}` : null,
    encryption: encryptionKey().source,
    models,
    modelsSource: source,
  };
}

export async function updateAiSettings(update: {
  model?: string;
  apiKey?: string | null;
}): Promise<AiSettingsResponse> {
  if (update.apiKey === null) await writeSetting(KEY_API_KEY, null);
  if (typeof update.apiKey === 'string') {
    // Checked against OpenAI first, so a mistyped key is refused, not stored.
    await fetchAccountModels(update.apiKey);
    await writeSetting(KEY_API_KEY, encryptSecret(update.apiKey, encryptionKey().key));
    modelCache = null;
  }
  if (update.model !== undefined) await writeSetting(KEY_MODEL, update.model);
  return getAiSettings();
}
