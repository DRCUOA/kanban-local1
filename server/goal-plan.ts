import { ChatOpenAI } from '@langchain/openai';
import { format } from 'date-fns';
import {
  GOAL_PLAN_SYSTEM_PROMPT,
  buildGoalPlanUserPrompt,
  descriptionToPlainText,
  goalPlanSuggestionSchema,
  normaliseGoalPlan,
  type GoalPlanContext,
  type GoalPlanSuggestion,
} from '@shared/goal-plan';
import { TASK_TYPE } from '@shared/constants';
import { isClosedTaskByStage } from '@shared/stage-state';
import type { Task } from '@shared/schema';
import { storage } from './storage';
import { getAiConfig } from './settings';
import { logger } from '@shared/logger';

const TIMEOUT_MS = 60_000;

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
export async function suggestGoalPlan(goalId: number): Promise<GoalPlanSuggestion> {
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
  // Responses API with JSON-schema output: GPT-6 models support structured
  // output there, while some (e.g. gpt-6.1-sol) offer no tool calling on Chat
  // Completions, which is what LangChain's default structured output relies on.
  const model = new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    useResponsesApi: true,
  });
  const runnable = model.withStructuredOutput(goalPlanSuggestionSchema, {
    name: 'goal_plan',
    method: 'jsonSchema',
    strict: true,
  });
  const started = Date.now();
  const raw = await runnable.invoke([
    { role: 'system', content: GOAL_PLAN_SYSTEM_PROMPT },
    { role: 'user', content: buildGoalPlanUserPrompt(ctx) },
  ]);
  logger.info('goal-plan suggestion', {
    goalId,
    model: config.model,
    ms: Date.now() - started,
    subtasks: raw.subtasks.length,
  });
  return normaliseGoalPlan(
    raw,
    ctx.existingBlocks.map((b) => b.id),
  );
}
