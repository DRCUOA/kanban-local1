// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Task } from '@shared/schema';
import { TASK_PRIORITY, TASK_RECURRENCE, TASK_STATUS } from '@shared/constants';
import { formatTaskAsEmail, formatTasksAsEmail, formatTaskAsTextBlock } from './task-email';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 42,
    title: 'Design homepage',
    description: '<p>Wireframe the <strong>hero</strong> section.</p>',
    stageId: 2,
    archived: false,
    status: TASK_STATUS.IN_PROGRESS,
    priority: TASK_PRIORITY.HIGH,
    effort: 3,
    // Local-time constructors keep the formatted date stable across time zones.
    dueDate: new Date(2026, 7, 15),
    updatedAt: new Date(2026, 7, 12),
    createdAt: new Date(2026, 7, 10),
    tags: ['design', 'web'],
    parentTaskId: null,
    recurrence: TASK_RECURRENCE.NONE,
    history: null,
    owner: 'Rich',
    ...overrides,
  } as Task;
}

describe('formatTaskAsEmail', () => {
  it('uses the task title as the subject and repeats it in the text', () => {
    const email = formatTaskAsEmail(makeTask());

    expect(email.subject).toBe('Task: Design homepage');
    expect(email.text.startsWith('Subject: Task: Design homepage\n\n')).toBe(true);
    expect(email.text).toContain('Design homepage');
  });

  it('includes every populated detail, with the stage name when supplied', () => {
    const email = formatTaskAsEmail(makeTask(), { stageName: 'In Progress' });

    expect(email.body).toContain('Stage:');
    expect(email.body).toContain('In Progress');
    expect(email.body).toContain('Priority:');
    expect(email.body).toContain('High');
    expect(email.body).toContain('Owner:');
    expect(email.body).toContain('Rich');
    expect(email.body).toContain('Effort:');
    expect(email.body).toContain('3 of 5');
    expect(email.body).toContain('Saturday, 15 August 2026');
    expect(email.body).toContain('design, web');
    expect(email.body).toContain('Task #42');
  });

  it('omits rows that have no value', () => {
    const email = formatTaskAsEmail(
      makeTask({ owner: null, effort: null, dueDate: null, tags: [] }),
    );

    expect(email.body).not.toContain('Owner:');
    expect(email.body).not.toContain('Effort:');
    expect(email.body).not.toContain('Due:');
    expect(email.body).not.toContain('Tags:');
  });

  it('renders the description as plain text in the text flavour', () => {
    const email = formatTaskAsEmail(makeTask());

    expect(email.body).toContain('Description');
    expect(email.body).toContain('Wireframe the hero section.');
    expect(email.body).not.toContain('<strong>');
  });

  it('drops the description section when there is nothing to say', () => {
    const email = formatTaskAsEmail(makeTask({ description: '<p></p>' }));

    expect(email.body).not.toContain('Description');
  });

  it('keeps formatting in the html flavour and escapes plain values', () => {
    const email = formatTaskAsEmail(makeTask({ owner: 'A & B' }), { stageName: 'In Progress' });

    expect(email.html).toContain('<strong>hero</strong>');
    expect(email.html).toContain('A &amp; B');
    expect(email.html).toContain('Subject:');
  });

  it('escapes a title that contains markup', () => {
    const email = formatTaskAsEmail(makeTask({ title: 'Fix <script> tag' }));

    expect(email.subject).toBe('Task: Fix <script> tag');
    expect(email.html).toContain('Fix &lt;script&gt; tag');
    expect(email.html).not.toContain('<script>');
  });

  it('never produces a mailto link or other send action', () => {
    const email = formatTaskAsEmail(makeTask());

    expect(email.text).not.toContain('mailto:');
    expect(email.html).not.toContain('mailto:');
  });
});

describe('formatTasksAsEmail', () => {
  it('matches the single-task format exactly for one task', () => {
    const single = formatTaskAsEmail(makeTask(), { stageName: 'In Progress' });
    const viaList = formatTasksAsEmail([makeTask()], { stageNameFor: () => 'In Progress' });

    expect(viaList).toEqual(single);
  });

  it('shares one envelope with a rule between tasks for several tasks', () => {
    const email = formatTasksAsEmail([
      makeTask({ id: 1, title: 'First' }),
      makeTask({ id: 2, title: 'Second' }),
    ]);

    expect(email.subject).toBe('Tasks from my board (2)');
    expect(email.text).toContain('Here are 2 tasks from my board:');
    expect(email.text.match(/^-{40}$/gm)).toHaveLength(1);
    expect(email.text).toContain('2 tasks (#1, #2)');
    // One greeting and one sign-off, not one per task.
    expect(email.text.match(/^Hi,$/gm)).toHaveLength(1);
    expect(email.text.match(/^Thanks,$/gm)).toHaveLength(1);
    expect(email.html.match(/<hr /g)).toHaveLength(1);
  });

  it('resolves each task stage independently', () => {
    const email = formatTasksAsEmail(
      [makeTask({ id: 1, stageId: 1 }), makeTask({ id: 2, stageId: 2 })],
      { stageNameFor: (task) => (task.stageId === 1 ? 'To Do' : 'Doing') },
    );

    expect(email.text).toContain('To Do');
    expect(email.text).toContain('Doing');
  });
});

describe('formatTaskAsTextBlock', () => {
  it('renders title, details and description without the email envelope', () => {
    const block = formatTaskAsTextBlock(makeTask(), { stageName: 'In Progress' });

    expect(block).toContain('Design homepage');
    expect(block).toContain('In Progress');
    expect(block).toContain('Wireframe the hero section.');
    expect(block).not.toContain('Hi,');
    expect(block).not.toContain('Thanks,');
    expect(block).not.toContain('Subject:');
  });
});
