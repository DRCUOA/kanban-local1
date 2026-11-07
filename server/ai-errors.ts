import { AuthenticationError } from 'openai';

/** The status and JSON body a route answers with when an OpenAI call fails. */
export interface AiFailure {
  status: number;
  body: { error: string; status: number };
}

/**
 * How a failed OpenAI call is answered. Never with 502 or 504: Cloudflare, in
 * front of production, swaps an origin's 502 or 504 for its own HTML page, so
 * the message never reached the browser (seen on 7 Nov 2026).
 *
 * A key OpenAI turns down is the user's to fix, so it is a 400 saying where.
 * Anything else (unknown model, quota, timeout, OpenAI down) is a 503 with the
 * provider's own message, which is what the user needs and holds no secret.
 */
export function aiFailure(error: unknown): AiFailure {
  if (error instanceof AuthenticationError) {
    const message =
      'OpenAI turned down the API key. Replace it on the Admin page (AI assistant), which also says where the key in use comes from.';
    return { status: 400, body: { error: message, status: 400 } };
  }
  const detail = error instanceof Error ? error.message : 'AI request failed';
  const message = `The AI request failed: ${detail}`;
  return { status: 503, body: { error: message, status: 503 } };
}
