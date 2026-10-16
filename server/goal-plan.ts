import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { format } from 'date-fns';
import {
  buildGoalPlanInstructions,
  buildGoalPlanUserPrompt,
  descriptionToPlainText,
  goalPlanSuggestionSchema,
  normaliseGoalPlan,
  type GoalPlanContext,
  type GoalPlanOptions,
  type GoalPlanSuggestion,
} from '@shared/goal-plan';
import { TASK_TYPE } from '@shared/constants';
import { isClosedTaskByStage } from '@shared/stage-state';
import type { Task } from '@shared/schema';
import { storage } from './storage';
import { getAiConfig } from './settings';
import { logger } from '@shared/logger';

/** Web search makes a plan slower; it still has to finish while the person waits. */
const TIMEOUT_MS = 60_000;
const TIMEOUT_WITH_SEARCH_MS = 150_000;

/** A request the user can fix (wrong type, no key): answered 400 with the message. */
export class GoalPlanRequestError extends Error {}

/** Everything the prompt says about the goal, read fresh from the database. */
async function goalContext(goal: Task): Promise<GoalPlanContext> {
  const [stages, tasks, edges, owners] = await Promise.all([
    storage.getStages(),
    storage.getTasks(),
    storage.getTaskDependencies(),
    storage.getOwners(),
  ]);
  const project = goal.projectId ? await storage.getProjectById(goal.projectId) : undefined;
  const blocks = tasks.filter(
    (t) => t.type === TASK_TYPE.BUILDING_BLOCK && t.goalTaskId === goal.id && !t.archived,
  );
  return {
    id: goal.id,
    title: goal.title,
    description: descriptionToPlainText(goal.description),
    priority: goal.priority,
    dueDate: goal.dueDate ? format(new Date(goal.dueDate), 'yyyy-MM-dd') : null,
    stage: stages.find((s) => s.id === goal.stageId)?.name.trim() ?? null,
    project: project?.name ?? null,
    owner: owners.find((o) => o.id === goal.ownerId)?.name ?? null,
    effort: goal.effort,
    today: format(new Date(), 'yyyy-MM-dd'),
    existingBlocks: blocks.map((b) => ({
      id: b.id,
      title: b.title,
      done: isClosedTaskByStage(b, stages),
      dependsOn: edges.filter((e) => e.successorId === b.id).map((e) => e.predecessorId),
    })),
  };
}

/**
 * Asks the configured OpenAI model to break a goal into building-blocks. The
 * same checks the form runs (saved, type goal) are repeated here, because the
 * endpoint can be called directly.
 */
export async function suggestGoalPlan(
  goalId: number,
  options: GoalPlanOptions = { how: false, whoWhere: false },
): Promise<GoalPlanSuggestion> {
  const goal = await storage.getTaskById(goalId);
  if (!goal || goal.deletedAt) throw new GoalPlanRequestError('Task not found');
  if (goal.type !== TASK_TYPE.GOAL) {
    throw new GoalPlanRequestError('Set the task type to Goal and save before planning it');
  }
  const config = await getAiConfig();
  if (!config.apiKey) {
    throw new GoalPlanRequestError(
      'No OpenAI API key is set. Add one on the Admin page (AI assistant).',
    );
  }

  const ctx = await goalContext(goal);
  // One Responses API call: structured output pins the JSON shape, and "who
  // and where" adds the web search tool so contact details are current and
  // come with the page they were read from.
  const client = new OpenAI({
    apiKey: config.apiKey,
    timeout: options.whoWhere ? TIMEOUT_WITH_SEARCH_MS : TIMEOUT_MS,
    maxRetries: 1,
  });
  const started = Date.now();
  const response = await client.responses.parse({
    model: config.model,
    instructions: buildGoalPlanInstructions(options),
    input: buildGoalPlanUserPrompt(ctx),
    text: { format: zodTextFormat(goalPlanSuggestionSchema, 'goal_plan') },
    ...(options.whoWhere ? { tools: [{ type: 'web_search' as const }] } : {}),
  });
  const raw = response.output_parsed;
  if (!raw) throw new Error('The model returned no plan');
  logger.info('goal-plan suggestion', {
    goalId,
    model: config.model,
    how: options.how,
    whoWhere: options.whoWhere,
    ms: Date.now() - started,
    subtasks: raw.subtasks.length,
    contacts: raw.subtasks.reduce((n, st) => n + st.contacts.length, 0),
  });
  return normaliseGoalPlan(
    raw,
    ctx.existingBlocks.map((b) => b.id),
  );
}
