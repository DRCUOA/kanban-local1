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

  // Real Response objects from here on: a body can be read once, which a
  // hand-made stand-in with separate json() and text() did not enforce, and
  // that hid "body stream already read" in production (7 Nov 2026).
  async function failure(res: Response): Promise<ApiError> {
    mockFetch.mockResolvedValueOnce(res);
    const err: unknown = await apiRequest('/api/fail').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    return err as ApiError;
  }

  it('throws ApiError with the text when a failed response is plain text', async () => {
    const err = await failure(
      new Response('plain error text', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' },
      }),
    );
    expect(err.status).toBe(500);
    expect(err.body).toBe('plain error text');
  });

  it('reads the JSON error from a real failed response', async () => {
    const err = await failure(
      new Response(JSON.stringify({ error: 'The AI request failed: quota', status: 503 }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(err.body).toBe('The AI request failed: quota');
  });

  it("gives the status, not the markup, for a proxy's HTML error page", async () => {
    // What Cloudflare sends in place of an origin 502; HTTP/2 has no status text.
    const err = await failure(
      new Response('<!DOCTYPE html><html><title>502 Bad gateway</title>cloudflare</html>', {
        status: 502,
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      }),
    );
    expect(err.status).toBe(502);
    expect(err.body).toBe('The server answered 502');
  });

  it('falls back to the status text when a failed response has no body', async () => {
    const err = await failure(new Response(null, { status: 500, statusText: 'Server Error' }));
    expect(err.body).toBe('Server Error');
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
