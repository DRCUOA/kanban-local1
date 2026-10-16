import { z } from 'zod';
import { EFFORT_MAX, EFFORT_MIN } from './constants';

/**
 * "Make this a goal": an LLM turns a goal task into a sharper goal statement
 * and a chronologically ordered set of building-blocks, which the user edits
 * and saves into the app's own model (type, goal link, dependencies).
 */

export const GOAL_PLAN_MIN_SUBTASKS = 3;
export const GOAL_PLAN_MAX_SUBTASKS = 12;
/** With "help me on the how" the steps are smaller, so there are more of them. */
export const GOAL_PLAN_MAX_SUBTASKS_HOW = 20;
export const SUBTASK_TITLE_MAX = 80;

/** What the model must return. Strict: every key present, nothing extra. */
/** Someone to contact or somewhere to go for a sub-task ("help me on the who and where"). */
export const goalPlanContactSchema = z.object({
  name: z
    .string()
    .describe('The organisation, service or kind of person, e.g. "Waikato District Council".'),
  purpose: z.string().describe('What they are for in this step, in a few words.'),
  phone: z.string().nullable().describe('Phone number as published, or null if not found.'),
  email: z.string().nullable().describe('Email address as published, or null if not found.'),
  website: z.string().nullable().describe('The most specific official page, or null.'),
  address: z.string().nullable().describe('Physical address if they must be visited, or null.'),
  source: z
    .string()
    .nullable()
    .describe('URL of the page these details were taken from, or null if not looked up.'),
});
export type GoalPlanContact = z.infer<typeof goalPlanContactSchema>;

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
        contacts: z
          .array(goalPlanContactSchema)
          .describe('Who to contact or where to go for this step. Empty unless asked for.'),
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
  - "dependsOn": keys of EARLIER sub-tasks, or ids of existing building-blocks, that must finish before this one can start. Leave it empty if it can start straight away. Steps that can happen in parallel must not depend on each other.
  - "contacts": who to contact or where to go for the step (see below if asked); otherwise an empty list.`;

/** The two "help me" options on the dialog; either, both or neither. */
export const goalPlanOptionsSchema = z.object({
  how: z.boolean().default(false),
  whoWhere: z.boolean().default(false),
});
export type GoalPlanOptions = z.infer<typeof goalPlanOptionsSchema>;

/**
 * "Help me on the how": plain explanations and a direct, physical breakdown.
 * It deliberately lowers the diminishing-returns bar of the base brief, which
 * is what the person asked for by ticking it.
 */
export const HOW_INSTRUCTIONS = `HELP ME ON THE HOW (the person ticked this, so it overrides constraint 2 where they conflict):
- Write for someone doing this for the first time. Use plain words and no jargon; where a term is unavoidable, explain it in a few words.
- Break the work into direct, concrete actions in the order they happen, at the level of "boil some water to 100°C; meanwhile take an empty cup from the pantry cupboard; take the milk from the fridge". Each sub-task is one such action or a short run of them that happen together.
- Return up to ${GOAL_PLAN_MAX_SUBTASKS_HOW} sub-tasks. Smaller, clearer steps are wanted here, still exactly one layer deep.
- In each description: the actions as short numbered lines ("1. … 2. …"), then one plain sentence on why it matters or what "done" looks like when that is not obvious.
- Mark steps that can happen at the same time by giving them the same predecessors rather than chaining them.`;

/**
 * "Help me on the who and where": current contact details from web search.
 * The person is assumed to be in New Zealand (the app's time zone).
 */
export const WHO_WHERE_INSTRUCTIONS = `HELP ME ON THE WHO AND WHERE (the person ticked this; web search is available, use it):
- For every sub-task that involves another person, organisation, service, shop or place, search the web for the right one now and fill "contacts": the name, what they are for in this step, phone, email, the most specific official web page, and a physical address if they must be visited.
- The person is in New Zealand unless the task says otherwise. Prefer official and local sources (government, council, the organisation's own site) over directories and aggregators.
- Copy phone numbers, emails and links exactly as published, and put the URL you took them from in "source". Never invent or guess a detail: if you cannot find it, use null and say in the description how to find it.
- Where several providers would do (e.g. any builder), give two or three good options rather than one.
- Sub-tasks that involve no one else have an empty "contacts" list.`;

/** The full instruction text for the chosen options. */
export function buildGoalPlanInstructions(options: GoalPlanOptions): string {
  const parts = [GOAL_PLAN_SYSTEM_PROMPT];
  if (options.how) parts.push(HOW_INSTRUCTIONS);
  if (options.whoWhere) parts.push(WHO_WHERE_INSTRUCTIONS);
  else parts.push('Leave "contacts" empty on every sub-task.');
  return parts.join('\n\n');
}

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

const httpUrl = (value: string | null): string | null => {
  const v = value?.trim() ?? '';
  return /^https?:\/\/\S+$/i.test(v) ? v : null;
};
const text = (value: string | null): string | null => {
  const v = value?.trim() ?? '';
  return v === '' ? null : v;
};

/** A contact with blanks as null and links kept only when they are real http(s) URLs. */
export function cleanContact(c: GoalPlanContact): GoalPlanContact {
  return {
    name: c.name.trim(),
    purpose: c.purpose.trim(),
    phone: text(c.phone),
    email: text(c.email),
    website: httpUrl(c.website),
    address: text(c.address),
    source: httpUrl(c.source),
  };
}

/** The contacts as a Markdown section, appended to a saved building-block's description. */
export function contactsToMarkdown(contacts: GoalPlanContact[]): string {
  if (contacts.length === 0) return '';
  const lines = contacts.map((c) => {
    const bits = [
      c.phone && `phone ${c.phone}`,
      c.email && `email ${c.email}`,
      c.website && `[website](${c.website})`,
      c.address && `at ${c.address}`,
    ].filter(Boolean);
    const source = c.source ? ` ([source](${c.source}))` : '';
    return `- **${c.name}**${c.purpose ? `: ${c.purpose}` : ''}${bits.length ? `. ${bits.join(', ')}` : ''}${source}`;
  });
  return `**Who and where** (found by AI web search; check before relying on it)\n\n${lines.join('\n')}`;
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
    .slice(0, GOAL_PLAN_MAX_SUBTASKS_HOW)
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
      contacts: s.contacts.map(cleanContact).filter((c) => c.name !== ''),
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
