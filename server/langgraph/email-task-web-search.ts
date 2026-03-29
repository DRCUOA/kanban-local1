import OpenAI from 'openai';
import { getErrorTraceFields, logGmailInboundTrace } from '../gmail/inbound-trace';

export interface EmailHowToSource {
  title: string;
  url: string;
}

export interface EmailHowToSearchResult {
  query: string;
  summary: string;
  sources: EmailHowToSource[];
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for email task extraction');
  }
  return new OpenAI({ apiKey });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseSources(output: unknown): EmailHowToSource[] {
  if (!Array.isArray(output)) return [];

  const seenUrls = new Set<string>();
  const result: EmailHowToSource[] = [];
  for (const item of output) {
    const record = asObject(item);
    if (record?.type !== 'web_search_call') continue;

    const action = asObject(record.action);
    const sources = action?.sources;
    if (!Array.isArray(sources)) continue;

    for (const source of sources) {
      const sourceRecord = asObject(source);
      const url = typeof sourceRecord?.url === 'string' ? sourceRecord.url.trim() : '';
      if (!url || seenUrls.has(url)) continue;

      seenUrls.add(url);
      result.push({
        title:
          typeof sourceRecord?.title === 'string' && sourceRecord.title.trim()
            ? sourceRecord.title.trim()
            : url,
        url,
      });
    }
  }

  return result;
}

export async function searchHowToOnWeb(input: {
  subject: string;
  body: string;
  query: string;
  traceContext?: {
    inboundRowId?: number;
    gmailMessageId?: string;
    historyIdSeen?: string;
    normalizedBodyHash?: string;
  };
}): Promise<EmailHowToSearchResult | null> {
  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) return null;

  const model = process.env.OPENAI_WEB_SEARCH_MODEL ?? 'gpt-4.1-mini';
  const timeoutMs = parseInt(process.env.OPENAI_WEB_SEARCH_TIMEOUT_MS ?? '8000', 10);
  const client = getOpenAIClient();

  logGmailInboundTrace('langgraph.web_search_started', {
    inbound_row_id: input.traceContext?.inboundRowId,
    gmail_message_id: input.traceContext?.gmailMessageId,
    history_id_seen: input.traceContext?.historyIdSeen,
    normalized_body_hash: input.traceContext?.normalizedBodyHash,
    web_search_model: model,
    search_query_length: trimmedQuery.length,
  });

  try {
    const response = await withTimeout(
      client.responses.create({
        model,
        input: [
          {
            role: 'system',
            content:
              'You summarize web results for inbound email task creation. Return concise how-to guidance with concrete steps that can be turned into execution tasks.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  `Subject: ${input.subject}`,
                  '',
                  `Email body: ${input.body}`,
                  '',
                  `Focus question: ${trimmedQuery}`,
                  '',
                  'Search the web for up-to-date guidance. Summarize the answer in 4-8 short sentences with practical steps and implementation details.',
                ].join('\n'),
              },
            ],
          },
        ],
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
      }),
      timeoutMs,
      'OpenAI web search',
    );

    const summary = response.output_text.trim();
    if (!summary) {
      logGmailInboundTrace('langgraph.web_search_empty', {
        inbound_row_id: input.traceContext?.inboundRowId,
        gmail_message_id: input.traceContext?.gmailMessageId,
        history_id_seen: input.traceContext?.historyIdSeen,
        normalized_body_hash: input.traceContext?.normalizedBodyHash,
      });
      return null;
    }

    const sources = parseSources(response.output);
    logGmailInboundTrace('langgraph.web_search_completed', {
      inbound_row_id: input.traceContext?.inboundRowId,
      gmail_message_id: input.traceContext?.gmailMessageId,
      history_id_seen: input.traceContext?.historyIdSeen,
      normalized_body_hash: input.traceContext?.normalizedBodyHash,
      web_search_model: model,
      web_search_source_count: sources.length,
      web_search_summary_length: summary.length,
    });

    return {
      query: trimmedQuery,
      summary,
      sources,
    };
  } catch (error) {
    logGmailInboundTrace('langgraph.web_search_failed', {
      inbound_row_id: input.traceContext?.inboundRowId,
      gmail_message_id: input.traceContext?.gmailMessageId,
      history_id_seen: input.traceContext?.historyIdSeen,
      normalized_body_hash: input.traceContext?.normalizedBodyHash,
      web_search_model: model,
      ...getErrorTraceFields(error),
    });
    return null;
  }
}
