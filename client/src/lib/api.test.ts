import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, apiGet, apiPost, apiPatch, apiDelete, ApiError } from './api';

function noop() {
  /* intentionally swallow rejected promise */
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'content-length': String(JSON.stringify(body).length) }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function emptyResponse(status = 204, statusText = 'No Content'): Response {
  return {
    ok: true,
    status,
    statusText,
    headers: new Headers({ 'content-length': '0' }),
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

describe('apiRequest', () => {
  it('makes a GET request and returns parsed JSON', async () => {
    const data = [{ id: 1, name: 'Task' }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await apiRequest<typeof data>('/api/tasks');

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'GET',
      headers: {},
      body: undefined,
      credentials: 'include',
    });
    expect(result).toEqual(data);
  });

  it('makes a POST request with JSON body', async () => {
    const payload = { title: 'New task' };
    const created = { id: 1, ...payload };
    mockFetch.mockResolvedValueOnce(jsonResponse(created, 201, 'Created'));

    const result = await apiRequest<typeof created>('/api/tasks', {
      method: 'POST',
      body: payload,
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    expect(result).toEqual(created);
  });

  it('returns undefined for 204 No Content responses', async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());

    const result = await apiRequest<unknown>('/api/tasks/1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('returns undefined when content-length is 0', async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse(200, 'OK'));

    const result = await apiRequest<unknown>('/api/endpoint');

    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-OK response with JSON error body', async () => {
    const errorBody = { error: 'Not found', status: 404 };
    mockFetch.mockResolvedValueOnce(jsonResponse(errorBody, 404, 'Not Found'));

    await expect(apiRequest('/api/tasks/999')).rejects.toThrow(ApiError);

    await apiRequest('/api/tasks/999').catch(noop);

    mockFetch.mockResolvedValueOnce(jsonResponse(errorBody, 404, 'Not Found'));

    try {
      await apiRequest('/api/tasks/999');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.statusText).toBe('Not Found');
      expect(apiErr.body).toBe('Not found');
    }
  });

  it('throws ApiError with text body when JSON parsing fails', async () => {
    const res = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      json: () => Promise.reject(new SyntaxError('bad json')),
      text: () => Promise.resolve('plain error text'),
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(res);

    try {
      await apiRequest('/api/fail');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.body).toBe('plain error text');
    }
  });

  it('wraps network TypeError with a user-friendly message', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiRequest('/api/tasks')).rejects.toThrow(
      'Network error: Unable to connect to server',
    );
  });

  it('re-throws non-TypeError exceptions as-is', async () => {
    const customErr = new Error('something else');
    mockFetch.mockRejectedValueOnce(customErr);

    await expect(apiRequest('/api/tasks')).rejects.toThrow(customErr);
  });
});

describe('ApiError', () => {
  it('exposes status, statusText, and body properties', () => {
    const err = new ApiError(422, 'Unprocessable Entity', 'Validation failed');
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(422);
    expect(err.statusText).toBe('Unprocessable Entity');
    expect(err.body).toBe('Validation failed');
    expect(err.message).toBe('422: Validation failed');
  });

  it('falls back to statusText in message when body is empty', () => {
    const err = new ApiError(500, 'Internal Server Error', '');
    expect(err.message).toBe('500: Internal Server Error');
  });
});

describe('convenience helpers', () => {
  it('apiGet delegates to apiRequest with GET', async () => {
    const data = [1, 2, 3];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await apiGet<number[]>('/api/items');

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/items',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('apiPost delegates to apiRequest with POST and body', async () => {
    const body = { name: 'test' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }, 201));

    await apiPost('/api/items', body);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('apiPatch delegates to apiRequest with PATCH and body', async () => {
    const body = { name: 'updated' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'updated' }));

    await apiPatch('/api/items/1', body);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/items/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    );
  });

  it('apiDelete delegates to apiRequest with DELETE', async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());

    await apiDelete('/api/items/1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/items/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
