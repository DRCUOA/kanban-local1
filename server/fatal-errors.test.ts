import { describe, it, expect } from 'vitest';
import { describeFatal } from './fatal-errors';

describe('describeFatal', () => {
  it('leads with the kind and the message, and keeps the stack', () => {
    const line = describeFatal('Uncaught exception', new Error('DATABASE_URL must be set'));
    expect(line.startsWith('Uncaught exception: Error: DATABASE_URL must be set')).toBe(true);
    expect(line).toContain('\n    at ');
  });

  it('describes non-Error values too', () => {
    expect(describeFatal('Unhandled rejection', 'nope')).toBe('Unhandled rejection: nope');
    expect(describeFatal('Unhandled rejection', undefined)).toBe('Unhandled rejection: undefined');
  });
});
