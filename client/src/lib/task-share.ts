import { format } from 'date-fns';
import type { Task, Stage } from '@shared/schema';
import { exportFilename, type TaskExportBundle } from '@shared/export';
import { formatTasksAsEmail, formatTaskAsTextBlock } from '@/lib/task-email';

/**
 * Share-dialog content: what a given scope looks like in each format.
 *
 * Two scopes exist. `tasks` covers the Task View (one task) and the board's
 * multi-select (several); its JSON is a bare array, which the existing
 * Import Tasks flow accepts. `board` wraps the full export bundle so the
 * dialog's JSON output is byte-identical to the long-standing Export Tasks
 * download.
 */

export type ShareFormat = 'text' | 'json';

export type ShareScope =
  | { type: 'tasks'; tasks: Task[]; stages: Stage[] }
  | { type: 'board'; bundle: TaskExportBundle };

export interface ShareContent {
  /** The file body, and the plain flavour of a clipboard copy. */
  text: string;
  /** Rich clipboard flavour; only produced for the plain-text format. */
  html?: string;
  filename: string;
  mimeType: 'text/plain' | 'application/json';
}

/** `Design homepage!` → `design-homepage`, capped so filenames stay readable. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
}

function extension(fmt: ShareFormat): string {
  return fmt === 'json' ? 'json' : 'txt';
}

/** Follows the existing `taskflow-…` download naming. */
export function shareFilename(scope: ShareScope, fmt: ShareFormat, now: Date): string {
  if (scope.type === 'board') {
    // Preserve the Export Tasks filename exactly; only the extension varies.
    const stem = exportFilename(scope.bundle.exportedAt).replace(/\.json$/, '');
    return `${stem}.${extension(fmt)}`;
  }
  const [soleTask] = scope.tasks;
  if (scope.tasks.length === 1 && soleTask) {
    const slug = slugify(soleTask.title);
    return `taskflow-task-${soleTask.id}${slug ? `-${slug}` : ''}.${extension(fmt)}`;
  }
  return `taskflow-tasks-${scope.tasks.length}-${format(now, 'yyyy-MM-dd')}.${extension(fmt)}`;
}

function boardAsText(bundle: TaskExportBundle): string {
  const day = bundle.exportedAt.split('T')[0] ?? bundle.exportedAt;
  const stageName = new Map(bundle.stages.map((stage) => [stage.id, stage.name]));
  const lines = [
    'Kanban board export',
    `Exported: ${day}`,
    `${bundle.counts.stages} stages · ${bundle.counts.tasks} tasks`,
  ];

  const sortedStages = [...bundle.stages].sort((a, b) => a.order - b.order);
  for (const stage of sortedStages) {
    const stageTasks = bundle.tasks.filter((task) => task.stageId === stage.id);
    lines.push('', `== ${stage.name} (${stageTasks.length}) ==`);
    for (const task of stageTasks) {
      lines.push('', formatTaskAsTextBlock(task, { stageName: stage.name }));
    }
  }

  // Tasks whose stage is missing from the bundle still must not vanish.
  const orphans = bundle.tasks.filter((task) => !stageName.has(task.stageId));
  if (orphans.length > 0) {
    lines.push('', `== No stage (${orphans.length}) ==`);
    for (const task of orphans) {
      lines.push('', formatTaskAsTextBlock(task));
    }
  }

  return lines.join('\n');
}

/** Build the content the share dialog copies or downloads. */
export function buildShareContent(scope: ShareScope, fmt: ShareFormat, now: Date): ShareContent {
  const filename = shareFilename(scope, fmt, now);

  if (fmt === 'json') {
    const payload = scope.type === 'board' ? scope.bundle : scope.tasks;
    return { text: JSON.stringify(payload, null, 2), filename, mimeType: 'application/json' };
  }

  if (scope.type === 'board') {
    return { text: boardAsText(scope.bundle), filename, mimeType: 'text/plain' };
  }

  const stageName = new Map(scope.stages.map((stage) => [stage.id, stage.name]));
  const email = formatTasksAsEmail(scope.tasks, {
    stageNameFor: (task) => stageName.get(task.stageId) ?? null,
  });
  return { text: email.text, html: email.html, filename, mimeType: 'text/plain' };
}

/** Toast-friendly description of what a share produced. */
export function describeShareScope(scope: ShareScope): string {
  if (scope.type === 'board') return 'the board export';
  const [soleTask] = scope.tasks;
  if (scope.tasks.length === 1 && soleTask) return `task #${soleTask.id}`;
  return `${scope.tasks.length} tasks`;
}
