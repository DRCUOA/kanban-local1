import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { appSettings } from '@shared/schema';
import { DEFAULT_GOAL_PLAN_MODEL, type AiSettingsResponse } from '@shared/goal-plan';
import { SUGGESTED_OPENAI_MODELS } from '@shared/goal-plan';
import { db } from './db';

const KEY_MODEL = 'ai.openai_model';
const KEY_API_KEY = 'ai.openai_api_key';

/** The 32-byte encryption key, or null when SETTINGS_SECRET is not set. */
function secretKey(): Buffer | null {
  const secret = process.env.SETTINGS_SECRET;
  if (!secret || secret.length < 16) return null;
  return createHash('sha256').update(secret).digest();
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
    // Wrong or rotated SETTINGS_SECRET: treat as no stored key.
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
  keySource: 'admin' | 'env' | 'none';
}

/** The model and key the AI assistant uses: the Admin key first, then OPENAI_API_KEY. */
export async function getAiConfig(): Promise<AiConfig> {
  const model = (await readSetting(KEY_MODEL)) ?? DEFAULT_GOAL_PLAN_MODEL;
  const key = secretKey();
  const stored = await readSetting(KEY_API_KEY);
  const adminKey = stored && key ? decryptSecret(stored, key) : null;
  if (adminKey) return { model, apiKey: adminKey, keySource: 'admin' };
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return { model, apiKey: envKey, keySource: 'env' };
  return { model, apiKey: null, keySource: 'none' };
}

export async function getAiSettings(): Promise<AiSettingsResponse> {
  const config = await getAiConfig();
  return {
    model: config.model,
    keySource: config.keySource,
    keyHint: config.apiKey ? `…${config.apiKey.slice(-4)}` : null,
    canStoreKey: secretKey() !== null,
    suggestedModels: SUGGESTED_OPENAI_MODELS,
  };
}

/** Thrown when a key is sent but cannot be stored encrypted. */
export class SettingsUnavailableError extends Error {}

export async function updateAiSettings(update: {
  model?: string;
  apiKey?: string | null;
}): Promise<AiSettingsResponse> {
  if (update.model !== undefined) await writeSetting(KEY_MODEL, update.model);
  if (update.apiKey === null) await writeSetting(KEY_API_KEY, null);
  if (typeof update.apiKey === 'string') {
    const key = secretKey();
    if (!key) {
      throw new SettingsUnavailableError(
        'SETTINGS_SECRET is not set on the server, so the key cannot be stored encrypted. Set it (16+ characters) and restart, or use OPENAI_API_KEY.',
      );
    }
    await writeSetting(KEY_API_KEY, encryptSecret(update.apiKey, key));
  }
  return getAiSettings();
}
