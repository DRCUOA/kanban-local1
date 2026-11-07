import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const configMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class {
    responses = { create: createMock };
  },
}));
vi.mock('./settings', () => ({ getAiConfig: configMock }));

import { polishDescription, PolishRequestError } from './description-polish';

const chip =
  '<a data-file-chip="" data-file-name="quote.pdf" data-file-type="application/pdf" href="/api/attachments/12" class="file-chip">quote.pdf</a>';

describe('polishDescription', () => {
  beforeEach(() => {
    createMock.mockReset();
    configMock.mockResolvedValue({
      model: 'gpt-6.1-sol',
      polishModel: 'gpt-6-luna',
      apiKey: 'sk-test-1234567890',
      keySource: 'env',
    });
  });

  it('sends tokens, not attachments, to the polish model and puts the attachment back', async () => {
    createMock.mockResolvedValue({
      status: 'completed',
      output_text: '```html\n<p>Get the quote [[file:1]] signed.</p>\n```',
    });

    const result = await polishDescription({
      html: `<p>get quote ${chip} signed</p>`,
      instruction: 'Polish',
    });

    const sent = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.model).toBe('gpt-6-luna');
    expect(sent.store).toBe(false);
    expect(String(sent.input)).toContain('[[file:1]]');
    expect(String(sent.input)).not.toContain('/api/attachments');
    expect(result).toEqual({
      html: `<p>Get the quote ${chip} signed.</p>`,
      filesMovedToEnd: 0,
      model: 'gpt-6-luna',
    });
  });

  it('refuses before calling OpenAI when no key is set', async () => {
    configMock.mockResolvedValue({
      model: 'm',
      polishModel: 'm',
      apiKey: null,
      keySource: 'none',
    });
    await expect(polishDescription({ html: '<p>x</p>', instruction: 'y' })).rejects.toBeInstanceOf(
      PolishRequestError,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('says so when the reply was cut off, rather than offering half a description', async () => {
    createMock.mockResolvedValue({ status: 'incomplete', output_text: '<p>Half' });
    await expect(polishDescription({ html: '<p>x</p>', instruction: 'y' })).rejects.toThrow(
      /cut off/,
    );
  });

  it('fails on an empty reply', async () => {
    createMock.mockResolvedValue({ status: 'completed', output_text: '  ' });
    await expect(polishDescription({ html: '<p>x</p>', instruction: 'y' })).rejects.toThrow(
      /no text/,
    );
  });
});
