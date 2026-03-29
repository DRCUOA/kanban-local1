import { ChatOpenAI } from '@langchain/openai';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { getErrorTraceFields, logGmailInboundTrace } from '../gmail/inbound-trace';
import { type EmailHowToSearchResult, searchHowToOnWeb } from './email-task-web-search';

const taskDraftSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).nullable(),
  targetStageName: z.string().nullable(),
});

const intentSchema = z.object({
  isHowTo: z.boolean(),
  isEpic: z.boolean(),
  searchQuery: z.string().nullable(),
});

const epicBreakdownSchema = z.object({
  childTasks: z.array(taskDraftSchema).max(8),
});

export const extractionSchema = z.object({
  parentTask: taskDraftSchema,
  childTasks: z.array(taskDraftSchema).max(8),
  flags: z.object({
    isEpic: z.boolean(),
    usedWebSearch: z.boolean(),
  }),
  searchContext: z
    .object({
      query: z.string(),
      summary: z.string(),
      sources: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      ),
    })
    .nullable(),
});

type EmailIntent = z.infer<typeof intentSchema>;
type EpicBreakdown = z.infer<typeof epicBreakdownSchema>;
export type EmailTaskDraft = z.infer<typeof taskDraftSchema>;
export type EmailTaskExtraction = z.infer<typeof extractionSchema>;

export interface EmailTaskGraphDeps {
  structuredInvoke?<T>(schema: z.ZodType<T>, prompt: string): Promise<T>;
  searchHowTo?: (input: {
    subject: string;
    body: string;
    query: string;
    traceContext?: {
      inboundRowId?: number;
      gmailMessageId?: string;
      historyIdSeen?: string;
      normalizedBodyHash?: string;
    };
  }) => Promise<EmailHowToSearchResult | null>;
}

function makeStructuredInvoker(apiKey: string, modelName: string) {
  const model = new ChatOpenAI({ model: modelName, apiKey });
  return async function structuredInvoke<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const runnable = model.withStructuredOutput(schema);
    return runnable.invoke(prompt);
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeTaskDraft(task: EmailTaskDraft, fallbackTitle: string): EmailTaskDraft {
  const title = normalizeWhitespace(task.title || fallbackTitle) || fallbackTitle;
  const description = task.description ? task.description.trim() : null;
  const targetStageName = task.targetStageName ? task.targetStageName.trim() : null;
  return {
    title,
    description,
    priority: task.priority ?? null,
    targetStageName,
  };
}

function dedupeChildTasks(tasks: EmailTaskDraft[], parentTitle: string): EmailTaskDraft[] {
  const parentKey = normalizeWhitespace(parentTitle).toLowerCase();
  const seen = new Set<string>();
  const out: EmailTaskDraft[] = [];

  for (const task of tasks) {
    const normalized = normalizeTaskDraft(task, 'Untitled child task');
    const key = normalized.title.toLowerCase();
    if (!key || key === parentKey || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out.slice(0, 8);
}

function buildSearchContextText(searchContext: EmailHowToSearchResult | null): string {
  if (!searchContext) return 'No web-search enrichment was used.';

  const citedSources = searchContext.sources.length
    ? searchContext.sources.map((source) => `- ${source.title}: ${source.url}`).join('\n')
    : '- No sources returned';

  return [
    `Search query: ${searchContext.query}`,
    '',
    'Summary:',
    searchContext.summary,
    '',
    'Sources:',
    citedSources,
  ].join('\n');
}

function buildEpicCandidateText(childTasks: EmailTaskDraft[]): string {
  if (childTasks.length === 0) return 'No epic child-task candidates were generated.';
  return JSON.stringify(childTasks, null, 2);
}

function shouldRunHeavyWork(intent: EmailIntent | undefined): boolean {
  return Boolean(intent && (intent.isHowTo || intent.isEpic));
}

function finalizeExtraction(state: typeof EmailState.State): EmailTaskExtraction {
  if (!state.extracted) {
    throw new Error('LangGraph extraction produced no output');
  }

  const parentTask = normalizeTaskDraft(state.extracted.parentTask, state.subject);
  const extractedChildren = state.extracted.childTasks.length
    ? state.extracted.childTasks
    : state.epicCandidates;
  const childTasks = dedupeChildTasks(extractedChildren, parentTask.title);
  const isEpic = state.intent?.isEpic ?? (state.extracted.flags.isEpic || childTasks.length > 0);
  const searchContext = state.searchContext ?? null;

  return {
    parentTask,
    childTasks: isEpic ? childTasks : [],
    flags: {
      isEpic,
      usedWebSearch: Boolean(searchContext),
    },
    searchContext,
  };
}

const EmailState = Annotation.Root({
  subject: Annotation<string>,
  body: Annotation<string>,
  intent: Annotation<EmailIntent | undefined>,
  searchContext: Annotation<EmailHowToSearchResult | null | undefined>,
  epicCandidates: Annotation<EmailTaskDraft[]>({
    reducer: (left, right) => right,
    default: () => [],
  }),
  extracted: Annotation<EmailTaskExtraction | undefined>,
  result: Annotation<EmailTaskExtraction | undefined>,
});

export async function invokeEmailTaskGraph(
  input: {
    subject: string;
    body: string;
    traceContext?: {
      inboundRowId?: number;
      gmailMessageId?: string;
      historyIdSeen?: string;
      normalizedBodyHash?: string;
    };
  },
  deps: EmailTaskGraphDeps = {},
): Promise<EmailTaskExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for email task extraction');
  }
  const modelName = process.env.OPENAI_EMAIL_GRAPH_MODEL ?? 'gpt-4o-mini';
  const structuredInvoke = (() => {
    if (deps.structuredInvoke) {
      const invoke = deps.structuredInvoke.bind(deps);
      return <T>(schema: z.ZodType<T>, prompt: string) => invoke(schema, prompt);
    }
    return makeStructuredInvoker(apiKey, modelName);
  })();
  const searchHowTo = deps.searchHowTo ?? searchHowToOnWeb;

  const graph = new StateGraph(EmailState)
    .addNode('classifyIntent', async (state: typeof EmailState.State) => {
      logGmailInboundTrace('langgraph.classify_started', {
        inbound_row_id: input.traceContext?.inboundRowId,
        gmail_message_id: input.traceContext?.gmailMessageId,
        history_id_seen: input.traceContext?.historyIdSeen,
        normalized_body_hash: input.traceContext?.normalizedBodyHash,
      });

      const prompt = [
        'Classify the inbound email for task generation.',
        'Return isHowTo=true when the email is asking how to do something, troubleshoot something, or requesting instructions.',
        'Return isEpic=true when the email explicitly says it is an EPIC or clearly describes a large initiative that should be split into multiple atomic tasks.',
        'Only return searchQuery when isHowTo=true. Make it concise and web-search-ready.',
        '',
        `Subject: ${state.subject}`,
        '',
        state.body,
      ].join('\n');
      const intent = await structuredInvoke(intentSchema, prompt);

      logGmailInboundTrace('langgraph.classify_completed', {
        inbound_row_id: input.traceContext?.inboundRowId,
        gmail_message_id: input.traceContext?.gmailMessageId,
        history_id_seen: input.traceContext?.historyIdSeen,
        normalized_body_hash: input.traceContext?.normalizedBodyHash,
        is_how_to: intent.isHowTo,
        is_epic: intent.isEpic,
        has_search_query: Boolean(intent.searchQuery),
      });

      return { intent };
    })
    .addNode('parallelHeavyWork', async (state: typeof EmailState.State) => {
      logGmailInboundTrace('langgraph.parallel_heavy_work_started', {
        inbound_row_id: input.traceContext?.inboundRowId,
        gmail_message_id: input.traceContext?.gmailMessageId,
        history_id_seen: input.traceContext?.historyIdSeen,
        normalized_body_hash: input.traceContext?.normalizedBodyHash,
        run_search: Boolean(state.intent?.isHowTo && state.intent.searchQuery),
        run_epic_decompose: Boolean(state.intent?.isEpic),
      });

      const searchPromise =
        state.intent?.isHowTo && state.intent.searchQuery
          ? searchHowTo({
              subject: state.subject,
              body: state.body,
              query: state.intent.searchQuery,
              traceContext: input.traceContext,
            })
          : Promise.resolve(null);

      const epicPromise = state.intent?.isEpic
        ? structuredInvoke(
            epicBreakdownSchema,
            [
              'Break the email into 1-6 atomic child tasks.',
              'Return only actionable implementation tasks.',
              'Do not include the parent epic itself.',
              'Avoid duplicate or overlapping child tasks.',
              '',
              `Subject: ${state.subject}`,
              '',
              state.body,
            ].join('\n'),
          )
        : Promise.resolve<EpicBreakdown>({ childTasks: [] });

      const [searchResult, epicResult] = await Promise.allSettled([searchPromise, epicPromise]);
      const searchContext = searchResult.status === 'fulfilled' ? searchResult.value : null;
      const epicCandidates = epicResult.status === 'fulfilled' ? epicResult.value.childTasks : [];

      if (searchResult.status === 'rejected') {
        logGmailInboundTrace('langgraph.parallel_search_rejected', {
          inbound_row_id: input.traceContext?.inboundRowId,
          gmail_message_id: input.traceContext?.gmailMessageId,
          history_id_seen: input.traceContext?.historyIdSeen,
          normalized_body_hash: input.traceContext?.normalizedBodyHash,
          ...getErrorTraceFields(searchResult.reason),
        });
      }

      if (epicResult.status === 'rejected') {
        logGmailInboundTrace('langgraph.parallel_epic_rejected', {
          inbound_row_id: input.traceContext?.inboundRowId,
          gmail_message_id: input.traceContext?.gmailMessageId,
          history_id_seen: input.traceContext?.historyIdSeen,
          normalized_body_hash: input.traceContext?.normalizedBodyHash,
          ...getErrorTraceFields(epicResult.reason),
        });
      }

      logGmailInboundTrace('langgraph.parallel_heavy_work_completed', {
        inbound_row_id: input.traceContext?.inboundRowId,
        gmail_message_id: input.traceContext?.gmailMessageId,
        history_id_seen: input.traceContext?.historyIdSeen,
        normalized_body_hash: input.traceContext?.normalizedBodyHash,
        used_web_search: Boolean(searchContext),
        epic_candidate_count: epicCandidates.length,
      });

      return {
        searchContext,
        epicCandidates,
      };
    })
    .addNode('extractTasks', async (state: typeof EmailState.State) => {
      const extracted = await structuredInvoke(
        extractionSchema,
        [
          'Create board-ready task output from the email.',
          'Always return one parentTask that captures the original user request.',
          'If the email is not an epic, return childTasks as an empty array.',
          'If epic child-task candidates are provided, refine and keep only the concrete, atomic tasks.',
          'Use web-search guidance only when it exists. Blend it into descriptions instead of pasting raw search text.',
          'Descriptions should be practical and concise.',
          '',
          `Subject: ${state.subject}`,
          '',
          `Body: ${state.body}`,
          '',
          `Intent: ${JSON.stringify(state.intent ?? null)}`,
          '',
          'Web search context:',
          buildSearchContextText(state.searchContext ?? null),
          '',
          'Epic child-task candidates:',
          buildEpicCandidateText(state.epicCandidates),
        ].join('\n'),
      );
      return { extracted };
    })
    .addNode('finalizeOutput', (state: typeof EmailState.State) => {
      const result = finalizeExtraction(state);
      return { result };
    })
    .addEdge(START, 'classifyIntent')
    .addConditionalEdges('classifyIntent', (state: typeof EmailState.State) =>
      shouldRunHeavyWork(state.intent) ? 'parallelHeavyWork' : 'extractTasks',
    )
    .addEdge('parallelHeavyWork', 'extractTasks')
    .addEdge('extractTasks', 'finalizeOutput')
    .addEdge('finalizeOutput', END);

  const app = graph.compile();
  logGmailInboundTrace('langgraph.invoke_started', {
    inbound_row_id: input.traceContext?.inboundRowId,
    gmail_message_id: input.traceContext?.gmailMessageId,
    history_id_seen: input.traceContext?.historyIdSeen,
    normalized_body_hash: input.traceContext?.normalizedBodyHash,
    model: modelName,
    subject_length: input.subject.length,
    body_length: input.body.length,
  });
  try {
    const out = await app.invoke({
      subject: input.subject,
      body: input.body,
      intent: undefined,
      searchContext: undefined,
      epicCandidates: [],
      extracted: undefined,
      result: undefined,
    });
    if (!out.result) {
      throw new Error('LangGraph extraction produced no output');
    }
    logGmailInboundTrace('langgraph.invoke_completed', {
      inbound_row_id: input.traceContext?.inboundRowId,
      gmail_message_id: input.traceContext?.gmailMessageId,
      history_id_seen: input.traceContext?.historyIdSeen,
      normalized_body_hash: input.traceContext?.normalizedBodyHash,
      extracted_parent_title_present: Boolean(out.result.parentTask.title),
      extracted_parent_priority: out.result.parentTask.priority ?? null,
      extracted_parent_target_stage_name: out.result.parentTask.targetStageName ?? null,
      extracted_parent_description_present: Boolean(out.result.parentTask.description),
      extracted_child_task_count: out.result.childTasks.length,
      extracted_is_epic: out.result.flags.isEpic,
      extracted_used_web_search: out.result.flags.usedWebSearch,
    });
    return out.result;
  } catch (error) {
    logGmailInboundTrace('langgraph.invoke_failed', {
      inbound_row_id: input.traceContext?.inboundRowId,
      gmail_message_id: input.traceContext?.gmailMessageId,
      history_id_seen: input.traceContext?.historyIdSeen,
      normalized_body_hash: input.traceContext?.normalizedBodyHash,
      model: modelName,
      ...getErrorTraceFields(error),
    });
    throw error;
  }
}
