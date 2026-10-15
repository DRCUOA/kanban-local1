import { describe, expect, it } from 'vitest';
import {
  GOAL_PLAN_SYSTEM_PROMPT,
  applyGoalPlanSchema,
  buildGoalPlanUserPrompt,
  descriptionToPlainText,
  normaliseGoalPlan,
  type GoalPlanSuggestion,
} from './goal-plan';

const sub = (key: string, dependsOn: string[] = [], over = {}) => ({
  key,
  title: `Do ${key}`,
  description: 'd',
  effort: 2,
  dependsOn,
  ...over,
});
const plan = (subtasks: GoalPlanSuggestion['subtasks']): GoalPlanSuggestion => ({
  goal: { title: '  Build a shed  ', description: ' Done when it stands. ' },
  subtasks,
});

describe('system prompt', () => {
  it('keeps the brief and states the output contract', () => {
    expect(GOAL_PLAN_SYSTEM_PROMPT).toMatch(/^Act as an expert project planner/);
    expect(GOAL_PLAN_SYSTEM_PROMPT).toContain('exactly 1 layer deep');
    expect(GOAL_PLAN_SYSTEM_PROMPT).toContain('Diminishing Returns');
    expect(GOAL_PLAN_SYSTEM_PROMPT).toContain('"dependsOn"');
  });
});

describe('buildGoalPlanUserPrompt', () => {
  it('includes the task, its metadata and existing blocks', () => {
    const text = buildGoalPlanUserPrompt({
      id: 9,
      title: 'Build a shed',
      description: 'At the garden',
      priority: 'high',
      dueDate: '2026-11-18',
      stage: 'Backlog',
      project: 'Everyday',
      owner: 'Rich',
      effort: 5,
      today: '2026-10-16',
      existingBlocks: [{ id: 12, title: 'Measure', done: true, dependsOn: [11] }],
    });
    expect(text).toContain('Task ID: 9');
    expect(text).toContain('Context: At the garden');
    expect(text).toContain('Due date: 2026-11-18');
    expect(text).toContain('- #12 Measure (done), waits for #11');
  });
});

describe('normaliseGoalPlan', () => {
  it('trims, clamps effort, strips numbering and keeps only backward or existing deps', () => {
    const out = normaliseGoalPlan(
      plan([
        sub('S1', ['S2', '#5', '#99'], { title: '1. Measure ', effort: 9 }),
        sub('S2', ['S1', 'S3'], { effort: 0 }),
        sub('S3', ['S2', 'S3']),
      ]),
      [5],
    );
    expect(out.goal.title).toBe('Build a shed');
    expect(out.subtasks[0]).toMatchObject({ title: 'Measure', effort: 5, dependsOn: ['#5'] });
    expect(out.subtasks[1]).toMatchObject({ effort: 1, dependsOn: ['S1'] });
    expect(out.subtasks[2]?.dependsOn).toEqual(['S2']);
  });
  it('makes duplicate keys unique and drops empty titles', () => {
    const out = normaliseGoalPlan(plan([sub('A'), sub('A'), sub('B', [], { title: ' ' })]), []);
    expect(out.subtasks.map((s) => s.key)).toEqual(['A', 'S2']);
  });
});

describe('descriptionToPlainText', () => {
  it('flattens rich text to lines', () => {
    expect(descriptionToPlainText('<p>Shed &amp; path</p><ol><li>One</li><li>Two</li></ol>')).toBe(
      'Shed & path\n\n- One\n- Two',
    );
  });
});

describe('applyGoalPlanSchema', () => {
  it('rejects an empty title and out-of-range effort', () => {
    expect(
      applyGoalPlanSchema.safeParse({ subtasks: [sub('S1', [], { title: '' })] }).success,
    ).toBe(false);
    expect(
      applyGoalPlanSchema.safeParse({ subtasks: [sub('S1', [], { effort: 6 })] }).success,
    ).toBe(false);
    expect(applyGoalPlanSchema.safeParse({ subtasks: [sub('S1')] }).success).toBe(true);
  });
});
