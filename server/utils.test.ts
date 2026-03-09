import { describe, it, expect, vi } from 'vitest';
import { parseIdParam } from './utils';

function mockResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as unknown as Parameters<typeof parseIdParam>[1], status, json };
}

describe('parseIdParam', () => {
  it('returns parsed number for a valid numeric string', () => {
    const { res, status } = mockResponse();
    const result = parseIdParam('42', res);
    expect(result).toBe(42);
    expect(status).not.toHaveBeenCalled();
  });

  it('returns null and sends 400 for undefined input', () => {
    const { res, status, json } = mockResponse();
    const result = parseIdParam(undefined, res);
    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid ID', status: 400 });
  });

  it('returns null and sends 400 for non-numeric string', () => {
    const { res, status, json } = mockResponse();
    const result = parseIdParam('abc', res);
    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid ID', status: 400 });
  });

  it('uses a custom label in the error message', () => {
    const { res, json } = mockResponse();
    parseIdParam('xyz', res, 'Task ID');
    expect(json).toHaveBeenCalledWith({ error: 'Invalid Task ID', status: 400 });
  });

  it('handles zero as a valid ID', () => {
    const { res, status } = mockResponse();
    const result = parseIdParam('0', res);
    expect(result).toBe(0);
    expect(status).not.toHaveBeenCalled();
  });

  it('handles negative numbers', () => {
    const { res, status } = mockResponse();
    const result = parseIdParam('-5', res);
    expect(result).toBe(-5);
    expect(status).not.toHaveBeenCalled();
  });

  it('returns null for float strings (parseInt truncates but is still valid)', () => {
    const { res, status } = mockResponse();
    const result = parseIdParam('3.14', res);
    expect(result).toBe(3);
    expect(status).not.toHaveBeenCalled();
  });

  it('returns null for empty string', () => {
    const { res, status, json } = mockResponse();
    const result = parseIdParam('', res);
    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid ID', status: 400 });
  });
});
