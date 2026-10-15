import { describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret } from './settings';

describe('settings secret encryption', () => {
  const key = randomBytes(32);
  it('round-trips and never stores the plain value', () => {
    const stored = encryptSecret('sk-test-1234567890', key);
    expect(stored).not.toContain('sk-test');
    expect(decryptSecret(stored, key)).toBe('sk-test-1234567890');
  });
  it('returns null for a wrong key or a tampered value', () => {
    const stored = encryptSecret('sk-test-1234567890', key);
    expect(decryptSecret(stored, randomBytes(32))).toBeNull();
    const [v, iv, , data] = stored.split(':');
    const tampered = [v, iv, randomBytes(16).toString('base64'), data].join(':');
    expect(decryptSecret(tampered, key)).toBeNull();
    expect(decryptSecret('garbage', key)).toBeNull();
  });
});
