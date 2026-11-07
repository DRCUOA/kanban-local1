import OpenAI from 'openai';
import {
  POLISH_SYSTEM_PROMPT,
  buildPolishInput,
  cleanPolishReply,
  protectFileChips,
  restoreFileChips,
  type PolishRequest,
  type PolishResponse,
} from '@shared/description-polish';
import { getAiConfig } from './settings';
import { logger } from '@shared/logger';

/** The person is waiting with the popover open; past this it is better to say so. */
const TIMEOUT_MS = 30_000;
/** Includes the model's reasoning tokens, so it is well above the longest description. */
const MAX_OUTPUT_TOKENS = 8_000;

/** A request the user can fix (no key, a cut-off reply): answered 400 with the message. */
export class PolishRequestError extends Error {}

/**
 * Applies the instruction to the description in one Responses API call, with
 * attachments swapped for tokens on the way out and restored on the way back.
 * Only sizes and timings are logged, never the text.
 */
export async function polishDescription(request: PolishRequest): Promise<PolishResponse> {
  const config = await getAiConfig();
  if (!config.apiKey) {
    throw new PolishRequestError(
      'No OpenAI API key is set. Add one on the Admin page (AI assistant).',
    );
  }

  const { html, chips } = protectFileChips(request.html);
  const client = new OpenAI({ apiKey: config.apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const started = Date.now();
  const response = await client.responses.create({
    model: config.polishModel,
    instructions: POLISH_SYSTEM_PROMPT,
    input: buildPolishInput(request.instruction, html),
    reasoning: { effort: 'low' },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false,
  });
  if (response.status === 'incomplete') {
    throw new PolishRequestError(
      'The rewrite was cut off before it finished. Try a shorter instruction or description.',
    );
  }
  const reply = cleanPolishReply(response.output_text);
  if (!reply) throw new Error('The model returned no text');

  const restored = restoreFileChips(reply, chips);
  logger.info('description polish', {
    model: config.polishModel,
    ms: Date.now() - started,
    inChars: request.html.length,
    outChars: restored.html.length,
    files: chips.length,
    filesMovedToEnd: restored.movedToEnd,
  });
  return { html: restored.html, filesMovedToEnd: restored.movedToEnd, model: config.polishModel };
}
