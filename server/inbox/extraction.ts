import { TASK_PRIORITY_VALUES, type TaskPriorityValue } from '@shared/constants';
import type { EmailTaskExtraction } from '../langgraph/email-task-graph';

/**
 * What the inbound worker makes of a message: either the plain reading here,
 * or the LangGraph extraction (server/langgraph), which asks a model to find
 * the tasks in prose and needs OPENAI_API_KEY. `INBOX_EXTRACTION` chooses;
 * unset, the model is used when a key is configured and the plain reading
 * otherwise. It applies to every inbound message, the Gmail pipeline's too.
 */
export type ExtractionMode = 'plain' | 'llm';

export function extractionMode(env: NodeJS.ProcessEnv = process.env): ExtractionMode {
  const raw = env.INBOX_EXTRACTION?.trim().toLowerCase();
  if (raw === 'plain' || raw === 'llm') return raw;
  return env.OPENAI_API_KEY?.trim() ? 'llm' : 'plain';
}

/** What a subject says besides the title, in either mode. */
export interface SubjectDirectives {
  /** The subject with the directives taken out and the spacing closed up. */
  title: string;
  priority: TaskPriorityValue | null;
  /** As typed, with hyphens and underscores read as spaces: `@in-progress` is "in progress". */
  stageName: string | null;
}

const PRIORITY_DIRECTIVE = /(^|\s)!([a-z]+)\b/gi;
const STAGE_DIRECTIVE = /(^|\s)@([\p{L}\p{N}_-]+)/gu;

const isPriority = (word: string): word is TaskPriorityValue =>
  (TASK_PRIORITY_VALUES as readonly string[]).includes(word);

/**
 * `!high` (or `!low`, `!normal`, `!critical`) sets the priority and
 * `@in-progress` names the stage, anywhere in the subject; the last of each
 * wins, and both leave the title. A `!word` that is not a priority, or an
 * email address's `@`, is left alone: the directives need a space or the
 * start of the subject before them.
 */
export function parseSubjectDirectives(subject: string): SubjectDirectives {
  let priority: TaskPriorityValue | null = null;
  let stageName: string | null = null;
  let title = subject.replace(PRIORITY_DIRECTIVE, (match, lead: string, word: string) => {
    const lower = word.toLowerCase();
    if (!isPriority(lower)) return match;
    priority = lower;
    return lead;
  });
  title = title.replace(STAGE_DIRECTIVE, (_match, lead: string, name: string) => {
    stageName = name.replace(/[-_]+/g, ' ').trim();
    return lead;
  });
  return { title: title.replace(/\s+/g, ' ').trim(), priority, stageName };
}

/** The first line of a body with something on it, for a message with no subject. */
export function firstLineOf(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/**
 * The plain reading: one task, titled by the subject (or the body's first
 * line), described by the body, placed and prioritised by the directives.
 * No model, no children, no surprises.
 */
export function plainExtraction(subject: string, body: string): EmailTaskExtraction {
  const directives = parseSubjectDirectives(subject);
  const text = body.trim();
  return {
    parentTask: {
      title: directives.title || firstLineOf(text) || '(no subject)',
      description: text === '' ? null : text,
      priority: directives.priority,
      targetStageName: directives.stageName,
    },
    childTasks: [],
    flags: { isEpic: false, usedWebSearch: false },
    searchContext: null,
  };
}

/** What the subject said explicitly overrides what the model inferred. */
export function applySubjectDirectives(
  extraction: EmailTaskExtraction,
  directives: SubjectDirectives,
): EmailTaskExtraction {
  if (directives.priority === null && directives.stageName === null) return extraction;
  return {
    ...extraction,
    parentTask: {
      ...extraction.parentTask,
      priority: directives.priority ?? extraction.parentTask.priority,
      targetStageName: directives.stageName ?? extraction.parentTask.targetStageName,
    },
  };
}
