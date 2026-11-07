import { describe, expect, it } from 'vitest';
import { APIConnectionTimeoutError, AuthenticationError, NotFoundError } from 'openai';
import { aiFailure } from './ai-errors';

describe('aiFailure', () => {
  it('answers a key OpenAI turns down with a 400 that says where to replace it', () => {
    const error = new AuthenticationError(
      401,
      { message: 'Incorrect API key provided: sk-proj-****abcd.' },
      undefined,
      new Headers(),
    );
    const failure = aiFailure(error);
    expect(failure.status).toBe(400);
    expect(failure.body.error).toMatch(/Admin page \(AI assistant\)/);
    // The provider's message carries the masked key; it stays in the server log.
    expect(failure.body.error).not.toContain('sk-proj');
  });

  it('answers any other failure with a 503 and the provider message, never 502 or 504', () => {
    const notFound = aiFailure(
      new NotFoundError(404, { message: 'model not found' }, undefined, new Headers()),
    );
    expect(notFound.status).toBe(503);
    expect(notFound.body.error).toMatch(/^The AI request failed: .*model not found/);

    expect(aiFailure(new APIConnectionTimeoutError()).status).toBe(503);
    expect(aiFailure('odd').body).toEqual({
      error: 'The AI request failed: AI request failed',
      status: 503,
    });
  });
});
