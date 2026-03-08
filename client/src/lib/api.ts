import type { ApiErrorResponse } from '@shared/api-types';

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
  const { method = 'GET', body } = options;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
    let errorBody: string;
    try {
      const json = (await res.json()) as ApiErrorResponse;
      errorBody = json.error || JSON.stringify(json);
    } catch {
      errorBody = (await res.text()) || res.statusText;
    }
    throw new ApiError(res.status, res.statusText, errorBody);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return (await res.json()) as T;
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
