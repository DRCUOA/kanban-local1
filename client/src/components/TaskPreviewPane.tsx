import type { Stage, SubStage, Task, TaskHistoryEntry } from '@shared/schema';
import {
  EFFORT_MAX,
  TASK_PRIORITY,
  TASK_PRIORITY_LABEL,
  TASK_RECURRENCE,
  TASK_STATUS,
  TASK_STATUS_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from '@shared/constants';
import { cleanLabel, formatDueDayLabel, isDueTodayOn, isOverdueOn } from '@shared/briefing';
import { format } from 'date-fns';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  History,
  MousePointerClick,
  PanelRight,
  Repeat,
  SquarePen,
  User,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextContent } from './RichTextContent';
import { isRichTextEmpty } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

export interface TaskPreviewPaneProps {
  /** Task to preview; `null` renders the empty-state prompt. */
  task: Task | null;
  stages: Stage[];
  subStages: SubStage[];
  /** Colour of the task's stage, as the board resolves it. */
  stageColor?: string;
  /** "Open task" — the board opens its edit dialog. */
  onOpen: (task: Task) => void;
  /** Outer element ref — the board measures the pane while resizing the row. */
  outerRef?: (element: HTMLDivElement | null) => void;
  /** Flex sizing supplied by the board (it shares the column row). */
  style?: React.CSSProperties;
}

/** Newest-first history entries shown before the list is cut off. */
const HISTORY_LIMIT = 6;

const historyIcons: Record<string, typeof Circle> = {
  [TASK_STATUS.BACKLOG]: Circle,
  [TASK_STATUS.IN_PROGRESS]: Clock,
  [TASK_STATUS.DONE]: CheckCircle2,
  [TASK_STATUS.ABANDONED]: XCircle,
  archived: Archive,
};

const historyLabels: Record<string, string> = {
  ...TASK_STATUS_LABEL,
  archived: 'Archived',
};

/**
 * The lane the board files this task under: its most recently assigned tag
 * that names a sub-stage of its own stage (the board's rule — drag/drop
 * appends the newest assignment last). Tasks without one sit in the first
 * lane, which is what "unassigned" means here.
 */
function resolveSubStage(task: Task, subStages: SubStage[]): SubStage | null {
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const own = subStages.filter((s) => s.stageId === task.stageId);
  if (own.length === 0) return null;
  const tag = [...tags].reverse().find((t) => own.some((s) => s.tag === t));
  return tag === undefined ? null : (own.find((s) => s.tag === tag) ?? null);
}

function formatInstant(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, 'PP p');
}

function priorityClass(priority: TaskPriorityValue): string | undefined {
  if (priority === TASK_PRIORITY.HIGH) return 'border-warning/60 text-warning';
  if (priority === TASK_PRIORITY.CRITICAL) return 'border-danger/60 text-danger';
  return undefined;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Right-hand pane of the horizontal board: a full, read-only view of whichever
 * task the pointer (or keyboard focus, or the last click) rests on, so a card
 * can be read in full without opening it. Purely presentational — the board
 * decides which task is previewed.
 */
export function TaskPreviewPane({
  task,
  stages,
  subStages,
  stageColor,
  onOpen,
  outerRef,
  style,
}: TaskPreviewPaneProps) {
  return (
    <aside
      ref={outerRef}
      style={style}
      data-testid="task-preview-pane"
      data-preview-task-id={task?.id}
      aria-label="Task preview"
      className="flex min-h-0 min-w-[260px] flex-col neo-raised"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <PanelRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
            Preview
          </h2>
        </div>
        {task && (
          <Badge
            variant="secondary"
            className="min-h-[28px] rounded-lg px-3 py-1 font-mono text-base font-semibold neo-pressed"
          >
            #{task.id}
          </Badge>
        )}
      </div>

      {task ? (
        <PreviewBody
          task={task}
          stages={stages}
          subStages={subStages}
          stageColor={stageColor}
          onOpen={onOpen}
        />
      ) : (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
          data-testid="task-preview-empty"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full neo-pressed">
            <MousePointerClick className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Hover over or select a task on the board to preview it here.
          </p>
        </div>
      )}
    </aside>
  );
}

function PreviewBody({
  task,
  stages,
  subStages,
  stageColor,
  onOpen,
}: Required<Pick<TaskPreviewPaneProps, 'task' | 'stages' | 'subStages' | 'onOpen'>> & {
  task: Task;
  stageColor?: string;
}) {
  const stage = stages.find((s) => s.id === task.stageId);
  const subStage = resolveSubStage(task, subStages);
  const subStageTags = new Set(subStages.map((s) => s.tag));
  const tags = (Array.isArray(task.tags) ? task.tags : []).filter(
    (tag) => typeof tag === 'string' && tag.length > 0 && !subStageTags.has(tag),
  );

  const priority = (task.priority ?? TASK_PRIORITY.NORMAL) as TaskPriorityValue;
  const status = (task.status ?? TASK_STATUS.BACKLOG) as TaskStatusValue;
  const recurrence = task.recurrence ?? TASK_RECURRENCE.NONE;

  const now = new Date();
  const dueDayLabel = formatDueDayLabel(task.dueDate);
  const isOverdue = isOverdueOn(task.dueDate, now);
  const isDueToday = isDueTodayOn(task.dueDate, now);

  const history: TaskHistoryEntry[] = Array.isArray(task.history) ? task.history : [];
  const recentHistory = [...history].reverse().slice(0, HISTORY_LIMIT);
  const created = formatInstant(task.createdAt);
  const updated = formatInstant(task.updatedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: stageColor ?? stage?.color ?? undefined }}
              aria-hidden
            />
            <span className="font-medium text-foreground" data-testid="task-preview-stage">
              {stage ? cleanLabel(stage.name) : 'Unknown stage'}
            </span>
          </span>
          {subStage && (
            <>
              <span aria-hidden>·</span>
              <span data-testid="task-preview-substage">{cleanLabel(subStage.name)}</span>
            </>
          )}
        </div>

        <h3
          className="text-lg font-semibold leading-snug text-foreground"
          data-testid="task-preview-title"
        >
          {task.title}
        </h3>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="h-6 min-h-0 px-2 py-0 text-xs font-normal">
            {TASK_STATUS_LABEL[status]}
          </Badge>
          {priority !== TASK_PRIORITY.NORMAL && (
            <Badge
              variant="outline"
              className={cn('h-6 min-h-0 px-2 py-0 text-xs font-normal', priorityClass(priority))}
              data-testid="task-preview-priority"
            >
              {TASK_PRIORITY_LABEL[priority]}
            </Badge>
          )}
          {task.effort != null && (
            <Badge variant="secondary" className="h-6 min-h-0 px-2 py-0 text-xs font-normal">
              Effort {task.effort}/{EFFORT_MAX}
            </Badge>
          )}
          {task.owner && (
            <Badge
              variant="outline"
              className="h-6 min-h-0 max-w-[180px] gap-1 px-2 py-0 text-xs font-normal"
              data-testid="task-preview-owner"
            >
              <User className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{task.owner}</span>
            </Badge>
          )}
          {recurrence !== TASK_RECURRENCE.NONE && (
            <Badge
              variant="outline"
              className="h-6 min-h-0 gap-1 px-2 py-0 text-xs font-normal capitalize"
            >
              <Repeat className="h-3 w-3 shrink-0" aria-hidden />
              {recurrence}
            </Badge>
          )}
        </div>

        {dueDayLabel && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-sm',
              isOverdue && 'font-medium text-danger',
              isDueToday && 'font-medium text-warning',
              !isOverdue && !isDueToday && 'text-muted-foreground',
            )}
            data-testid="task-preview-due"
          >
            {isOverdue && <AlertCircle className="h-4 w-4" aria-hidden />}
            {isDueToday && <Clock className="h-4 w-4" aria-hidden />}
            <span>
              Due: {dueDayLabel}
              {isOverdue && ' (overdue)'}
              {isDueToday && ' (today)'}
            </span>
          </div>
        )}

        <Section title="Description">
          {isRichTextEmpty(task.description) ? (
            <p className="text-sm italic text-muted-foreground">No description</p>
          ) : (
            <div className="rounded-xl neo-well px-3 py-2.5">
              <RichTextContent
                value={task.description}
                className="text-sm"
                data-testid="task-preview-description"
              />
            </div>
          )}
        </Section>

        {tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1" data-testid="task-preview-tags">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-5 min-h-0 px-1.5 py-0 text-xs font-normal"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        <Section title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {created && (
              <>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">{created}</dd>
              </>
            )}
            {updated && (
              <>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-foreground">{updated}</dd>
              </>
            )}
            {task.parentTaskId != null && (
              <>
                <dt className="text-muted-foreground">Parent</dt>
                <dd className="text-foreground">#{task.parentTaskId}</dd>
              </>
            )}
          </dl>
        </Section>

        {recentHistory.length > 0 && (
          <Section title="History">
            <ol className="space-y-1.5" data-testid="task-preview-history">
              {recentHistory.map((entry, index) => {
                const Icon = historyIcons[entry.status] ?? Circle;
                const label = historyLabels[entry.status] ?? entry.status;
                const when = formatInstant(entry.timestamp);
                return (
                  <li
                    key={`${entry.timestamp}-${index}`}
                    className="flex items-start gap-2 text-xs"
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">Moved to {label}</div>
                      {entry.note && <div className="text-muted-foreground">{entry.note}</div>}
                      {when && <div className="text-muted-foreground">{when}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {history.length > recentHistory.length && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <History className="h-3 w-3" aria-hidden />
                {history.length - recentHistory.length} earlier{' '}
                {history.length - recentHistory.length === 1 ? 'entry' : 'entries'} in the task's
                history
              </p>
            )}
          </Section>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border/60 p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            onOpen(task);
          }}
          data-testid="task-preview-open"
        >
          <SquarePen aria-hidden />
          Open task
        </Button>
      </div>
    </div>
  );
}
