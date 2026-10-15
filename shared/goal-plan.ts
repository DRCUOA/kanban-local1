import { z } from 'zod';
import { EFFORT_MAX, EFFORT_MIN } from './constants';

/**
 * "Make this a goal": an LLM turns a goal task into a sharper goal statement
 * and a chronologically ordered set of building-blocks, which the user edits
 * and saves into the app's own model (type, goal link, dependencies).
 */

export const GOAL_PLAN_MIN_SUBTASKS = 3;
export const GOAL_PLAN_MAX_SUBTASKS = 12;
export const SUBTASK_TITLE_MAX = 80;

/** What the model must return. Strict: every key present, nothing extra. */
export const goalPlanSuggestionSchema = z.object({
  goal: z.object({
    title: z.string().describe('The goal restated as a clear outcome, at most 80 characters.'),
    description: z
      .string()
      .describe('Two to four sentences: what done looks like and why it matters.'),
  }),
  subtasks: z
    .array(
      z.object({
        key: z.string().describe('Stable reference for this sub-task: S1, S2, S3 … in list order.'),
        title: z.string().describe('Imperative, specific, at most 80 characters.'),
        description: z
          .string()
          .describe('One to three sentences of practical detail: what to do and what "done" is.'),
        effort: z
          .number()
          .int()
          .describe(
            'Whole number 1–5: roughly days of focused work. 1 = a day or less, 5 = a week or more.',
          ),
        dependsOn: z
          .array(z.string())
          .describe(
            'Keys of EARLIER sub-tasks (e.g. "S1") or ids of existing building-blocks (e.g. "#123") that must finish first. Empty when it can start immediately.',
          ),
      }),
    )
    .describe('Chronologically ordered building-blocks, one layer deep.'),
});
export type GoalPlanSuggestion = z.infer<typeof goalPlanSuggestionSchema>;

/** The goal and its context as the prompt sees them. */
export interface GoalPlanContext {
  id: number;
  title: string;
  description: string;
  priority: string | null;
  dueDate: string | null;
  stage: string | null;
  project: string | null;
  owner: string | null;
  effort: number | null;
  today: string;
  existingBlocks: { id: number; title: string; done: boolean; dependsOn: number[] }[];
}

/**
 * The instruction half of the prompt. The opening is the brief as written;
 * the rest pins the output to what the app can store: a goal statement and
 * building-blocks with an effort and explicit dependencies. The JSON shape is
 * also enforced by structured output, so this text explains intent rather than
 * syntax.
 */
export const GOAL_PLAN_SYSTEM_PROMPT = `Act as an expert project planner. I will provide task details (e.g., ID, name, context). Deconstruct this input into a clear overarching goal and a chronologically ordered list of building-block sub-tasks.

CRITICAL CONSTRAINTS:
1. Max Depth: Limit nesting to exactly 1 layer deep. Do not create sub-sub-tasks.
2. Diminishing Returns: Omit obvious, granular steps that are not worth the human time to track. Detail must balance practical execution with the overall goal's context.

ALSO:
3. Return between ${GOAL_PLAN_MIN_SUBTASKS} and ${GOAL_PLAN_MAX_SUBTASKS} sub-tasks. Fewer, meaningful steps beat many trivial ones.
4. Existing building-blocks are already tracked. Do not repeat them. Add only what is missing, and use their ids (e.g. "#123") in dependsOn where a new sub-task waits for one.
5. Use the description and metadata as given. Do not invent facts (names, prices, dates) that are not in the input; write the step so the person can fill them in.
6. Respect the due date if there is one: the total effort along any dependency chain should fit before it where realistic.

OUTPUT FORMAT: a JSON object with
- "goal": { "title", "description" } — the overarching goal restated as a clear outcome (title at most ${SUBTASK_TITLE_MAX} characters) and two to four sentences on what done looks like.
- "subtasks": the building-blocks in chronological order. Each has:
  - "key": "S1", "S2", … in list order;
  - "title": imperative and specific, at most ${SUBTASK_TITLE_MAX} characters, no numbering;
  - "description": one to three sentences of practical detail, plain text;
  - "effort": whole number ${EFFORT_MIN}–${EFFORT_MAX}, roughly days of focused work (1 = a day or less, 5 = a week or more);
  - "dependsOn": keys of EARLIER sub-tasks, or ids of existing building-blocks, that must finish before this one can start. Leave it empty if it can start straight away. Steps that can happen in parallel must not depend on each other.`;

/** The data half of the prompt: the task as entered, with its metadata. */
export function buildGoalPlanUserPrompt(ctx: GoalPlanContext): string {
  const lines = [
    `Today: ${ctx.today}`,
    `Task ID: ${ctx.id}`,
    `Name: ${ctx.title}`,
    `Context: ${ctx.description.trim() || '(none given)'}`,
    `Priority: ${ctx.priority ?? 'not set'}`,
    `Due date: ${ctx.dueDate ?? 'none'}`,
    `Stage: ${ctx.stage ?? 'unknown'}`,
    `Project: ${ctx.project ?? 'none'}`,
    `Owner: ${ctx.owner ?? 'unassigned'}`,
  ];
  if (ctx.effort != null) lines.push(`Effort estimate for the whole goal: ${ctx.effort}/5`);
  lines.push('');
  if (ctx.existingBlocks.length === 0) {
    lines.push('Existing building-blocks: none.');
  } else {
    lines.push('Existing building-blocks (already tracked; do not repeat):');
    for (const b of ctx.existingBlocks) {
      const deps = b.dependsOn.length
        ? `, waits for ${b.dependsOn.map((d) => `#${d}`).join(', ')}`
        : '';
      lines.push(`- #${b.id} ${b.title}${b.done ? ' (done)' : ''}${deps}`);
    }
  }
  return lines.join('\n');
}

/** Rich-text or Markdown description flattened for the prompt. */
export function descriptionToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Tidies what the model returned so the editor never starts from something the
 * app would refuse: titles trimmed and capped, effort clamped, keys made
 * unique, and dependencies kept only when they point at an earlier suggestion
 * or a real existing block (so the result is acyclic by construction).
 */
export function normaliseGoalPlan(
  plan: GoalPlanSuggestion,
  existingBlockIds: number[],
): GoalPlanSuggestion {
  const existing = new Set(existingBlockIds.map((id) => `#${id}`));
  const seen = new Set<string>();
  const subtasks = plan.subtasks
    .filter((s) => s.title.trim() !== '')
    .slice(0, GOAL_PLAN_MAX_SUBTASKS)
    .map((s, i) => {
      let key = s.key.trim() || `S${i + 1}`;
      if (seen.has(key)) key = `S${i + 1}`;
      seen.add(key);
      return { ...s, key };
    });
  const order = new Map(subtasks.map((s, i) => [s.key, i]));
  return {
    goal: {
      title: plan.goal.title.trim().slice(0, SUBTASK_TITLE_MAX),
      description: plan.goal.description.trim(),
    },
    subtasks: subtasks.map((s, i) => ({
      key: s.key,
      title: s.title
        .trim()
        .replace(/^\d+[.)]\s*/, '')
        .slice(0, SUBTASK_TITLE_MAX),
      description: s.description.trim(),
      effort: Math.min(EFFORT_MAX, Math.max(EFFORT_MIN, Math.round(s.effort || 1))),
      dependsOn: Array.from(
        new Set(
          s.dependsOn
            .map((d) => d.trim())
            .filter((d) => existing.has(d) || (order.get(d) ?? Infinity) < i),
        ),
      ),
    })),
  };
}

/** What the user saves: the suggestions they kept (edited), and optionally the goal text. */
export const applyGoalPlanSchema = z.object({
  goal: z.object({ title: z.string().trim().min(1).max(200), description: z.string() }).optional(),
  subtasks: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        description: z.string(),
        effort: z.number().int().min(EFFORT_MIN).max(EFFORT_MAX),
        /** Keys of other sub-tasks in this request, or ids of existing tasks as "#id". */
        dependsOn: z.array(z.string()),
      }),
    )
    .max(GOAL_PLAN_MAX_SUBTASKS * 2),
});
export type ApplyGoalPlan = z.infer<typeof applyGoalPlanSchema>;

export interface ApplyGoalPlanResult {
  /** Key of each saved suggestion → the new task's id. */
  created: Record<string, number>;
}

/**
 * GPT-5 and later only. Ids and notes from OpenAI's models pages
 * (developers.openai.com/api/docs/models, checked 16 Oct 2026); when a key is
 * set the Admin page lists what that key can actually use instead.
 */
export const CURATED_OPENAI_MODELS: { id: string; note: string }[] = [
  { id: 'gpt-6.1-sol', note: 'Balanced: near-Astra quality at lower cost (recommended)' },
  { id: 'gpt-6-astra', note: 'Most capable, highest cost' },
  { id: 'gpt-6-sol', note: 'Previous Sol' },
  { id: 'gpt-6-luna', note: 'Most efficient, lowest cost' },
  { id: 'gpt-5.6-sol', note: 'GPT-5.6 flagship' },
  { id: 'gpt-5.6-terra', note: 'GPT-5.6 mid tier' },
  { id: 'gpt-5.6-luna', note: 'GPT-5.6 efficient tier' },
  { id: 'gpt-5.5', note: 'GPT-5.5' },
  { id: 'gpt-5.4', note: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', note: 'GPT-5.4 small' },
  { id: 'gpt-5.2', note: 'GPT-5.2' },
  { id: 'gpt-5', note: 'GPT-5 (previous generation)' },
  { id: 'gpt-5-mini', note: 'GPT-5 small (previous generation)' },
  { id: 'gpt-5-nano', note: 'GPT-5 smallest (previous generation)' },
];
export const DEFAULT_GOAL_PLAN_MODEL = 'gpt-6.1-sol';

/**
 * True for a GPT text model of version 5 or later that can plan: excludes the
 * specialist families (audio, image, realtime, codex, security, pro, search)
 * and the "chat-latest" aliases.
 */
export function isPlanningModel(id: string): boolean {
  const m = /^gpt-(\d+)(?:\.\d+)?(?:-|$)/.exec(id);
  if (!m || Number(m[1]) < 5) return false;
  return !/(codex|cyber|realtime|audio|image|transcribe|tts|search|live|chat-latest|-pro\b|-\d{4}-\d{2}-\d{2}$)/.test(
    id,
  );
}

export interface AiModelOption {
  id: string;
  note: string | null;
}

/** Admin view of the AI settings. The key itself is never sent back. */
export interface AiSettingsResponse {
  model: string;
  /** Where the key in use comes from; 'unreadable' = a saved key that can no longer be decrypted. */
  keySource: 'admin' | 'env' | 'none' | 'unreadable';
  /** Last four characters of the key in use, for recognition. */
  keyHint: string | null;
  /** How a saved key is encrypted at rest. */
  encryption: 'settings-secret' | 'database-derived';
  /** Models to offer: what the key can use (GPT-5+), or the curated list without a key. */
  models: AiModelOption[];
  modelsSource: 'account' | 'curated';
}

export const updateAiSettingsSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(isPlanningModel, 'Choose a GPT-5 or later text model')
    .optional(),
  /** A new key to store, or null to remove the stored one (the env key then applies). */
  apiKey: z.string().trim().min(10).max(500).nullable().optional(),
});
export type UpdateAiSettings = z.infer<typeof updateAiSettingsSchema>;
