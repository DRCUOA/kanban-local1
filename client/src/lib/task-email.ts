import { format } from 'date-fns';
import type { Task } from '@shared/schema';
import {
  EFFORT_MAX,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from '@shared/constants';
import { isRichTextEmpty, richTextToPlainText, toRichHtml } from '@/lib/rich-text';

/**
 * Renders a task as a paste-ready email.
 *
 * Nothing here talks to a mail client: the caller puts the result on the
 * clipboard and the user pastes it into whichever app they like. Both a plain
 * text and an HTML flavour are produced so a rich-text compose window keeps the
 * layout while a plain one still reads cleanly.
 */

export interface TaskEmailOptions {
  /** Stage name resolved from `task.stageId`; omitted if unknown. */
  stageName?: string | null;
}

export interface TaskEmail {
  subject: string;
  /** Body only — greeting, details, description, sign-off. */
  body: string;
  /** `Subject: …` line followed by the body: one paste covers the whole email. */
  text: string;
  /** Same content as `text`, marked up for rich-text compose windows. */
  html: string;
}

const FOOTER = 'Shared from the kanban board';

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDate(value: unknown, pattern: string): string | null {
  const date = toDate(value);
  return date ? format(date, pattern) : null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Detail rows, in reading order; entries with no value are dropped. */
function buildDetails(task: Task, options: TaskEmailOptions): [string, string][] {
  const status = task.status ? TASK_STATUS_LABEL[task.status as TaskStatusValue] : null;
  const priority = task.priority ? TASK_PRIORITY_LABEL[task.priority as TaskPriorityValue] : null;
  const tags = Array.isArray(task.tags) ? task.tags.filter((tag) => tag.trim() !== '') : [];

  const rows: [string, string | null][] = [
    ['Stage', options.stageName ?? null],
    ['Status', status ?? null],
    ['Priority', priority ?? null],
    ['Owner', task.owner && task.owner.trim() !== '' ? task.owner : null],
    ['Effort', task.effort ? `${task.effort} of ${EFFORT_MAX}` : null],
    ['Due', formatDate(task.dueDate, 'EEEE, d MMMM yyyy')],
    ['Tags', tags.length > 0 ? tags.join(', ') : null],
    ['Created', formatDate(task.createdAt, 'd MMM yyyy')],
    ['Last updated', formatDate(task.updatedAt, 'd MMM yyyy')],
  ];

  return rows.filter((row): row is [string, string] => row[1] !== null && row[1] !== '');
}

function buildText(task: Task, details: [string, string][], description: string): string {
  // Pad labels so the values line up in a monospaced or plain-text client.
  const width = details.length > 0 ? Math.max(...details.map(([label]) => label.length)) + 2 : 0;
  const lines = [
    'Hi,',
    '',
    'Here is a task from my board:',
    '',
    `  ${task.title}`,
    '',
    ...details.map(([label, value]) => `  ${`${label}:`.padEnd(width)}${value}`),
  ];

  if (description) {
    lines.push('', 'Description', '-----------', description);
  }

  lines.push('', 'Thanks,', '', '--', `${FOOTER} · Task #${task.id}`);
  return lines.join('\n');
}

function buildHtml(
  task: Task,
  subject: string,
  details: [string, string][],
  descriptionHtml: string,
): string {
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:2px 0;vertical-align:top;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const descriptionBlock = descriptionHtml
    ? `<p style="margin:16px 0 4px;font-weight:600;">Description</p><div>${descriptionHtml}</div>`
    : '';

  return [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">`,
    `<p style="margin:0 0 12px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    `<p style="margin:0 0 12px;">Hi,</p>`,
    `<p style="margin:0 0 12px;">Here is a task from my board:</p>`,
    `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(task.title)}</p>`,
    `<table style="border-collapse:collapse;margin:0 0 4px;">${rows}</table>`,
    descriptionBlock,
    `<p style="margin:16px 0 12px;">Thanks,</p>`,
    `<p style="margin:0;color:#6b7280;font-size:12px;">${escapeHtml(`${FOOTER} · Task #${task.id}`)}</p>`,
    `</div>`,
  ].join('');
}

/** Build the shareable email for a task. */
export function formatTaskAsEmail(task: Task, options: TaskEmailOptions = {}): TaskEmail {
  const subject = `Task: ${task.title}`;
  const details = buildDetails(task, options);
  const hasDescription = !isRichTextEmpty(task.description);
  const description = hasDescription ? richTextToPlainText(task.description) : '';
  const descriptionHtml = hasDescription ? toRichHtml(task.description) : '';

  const body = buildText(task, details, description);
  return {
    subject,
    body,
    text: `Subject: ${subject}\n\n${body}`,
    html: buildHtml(task, subject, details, descriptionHtml),
  };
}
