import type { ApiErrorResponse } from '@shared/api-types';
import { ACCESS_REQUIRED } from '@shared/access';

/** Fired on window when the server says this browser needs an access code. */
export const ACCESS_REQUIRED_EVENT = 'kb-access-required';

/** Consistent error type thrown by apiRequest on non-OK responses */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`${status}: ${body || statusText}`);
    this.name = 'ApiError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Sent as-is (a file upload) instead of being JSON-encoded; `headers` then names its type. */
  rawBody?: BodyInit;
  headers?: Record<string, string>;
}

/**
 * Typed API request wrapper that centralises fetch, headers, JSON parsing,
 * and error handling for all client-side API calls.
 *
 * @example
 *   const tasks = await apiRequest<Task[]>('/api/tasks');
 *   const task  = await apiRequest<Task>('/api/tasks', { method: 'POST', body: newTask });
 */
export async function apiRequest<T = void>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, rawBody, headers } = options;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Network error: Unable to connect to server. Please check if the server is running.',
      );
    }
    throw error;
  }

  if (!res.ok) {
    const errorBody = await readErrorBody(res);
    // This browser is not (or no longer) admitted: the access gate in App
    // shows the access-code screen.
    if (res.status === 401 && errorBody === ACCESS_REQUIRED) {
      window.dispatchEvent(new Event(ACCESS_REQUIRED_EVENT));
    }
    throw new ApiError(res.status, res.statusText, errorBody);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * The message in a failed response, read once: the server's JSON `error`,
 * else its plain text, else the status. A body can be read only once, so it
 * is taken as text and parsed here; calling `json()` and then `text()` throws
 * "body stream already read" whenever the body is not JSON. Cloudflare, in
 * front of production, swaps an origin 502 or 504 for its own HTML page, and
 * that markup is never shown as the message.
 */
async function readErrorBody(res: Response): Promise<string> {
  const status = res.statusText ? `${res.status} ${res.statusText}` : String(res.status);
  const fallback = `The server answered ${status}`;
  let text: string;
  try {
    text = (await res.text()).trim();
  } catch {
    return fallback;
  }
  if (!text) return res.statusText || fallback;
  try {
    const json = JSON.parse(text) as Partial<ApiErrorResponse> | null;
    if (json && typeof json.error === 'string' && json.error) return json.error;
    return text;
  } catch {
    // Not JSON: plain text is the message, an HTML error page is not.
  }
  const isHtml = /html/i.test(res.headers.get('content-type') ?? '') || text.startsWith('<');
  return isHtml ? fallback : text;
}

export function apiGet<T>(url: string): Promise<T> {
  return apiRequest<T>(url);
}

export function apiPost<T = void>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, { method: 'POST', body });
}

export function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, { method: 'PATCH', body });
}

export function apiDelete(url: string): Promise<void> {
  return apiRequest(url, { method: 'DELETE' });
}

/** POST a raw body (a file) with the headers that describe it. */
export function apiUpload<T>(url: string, rawBody: BodyInit, headers: Record<string, string>) {
  return apiRequest<T>(url, { method: 'POST', rawBody, headers });
}
