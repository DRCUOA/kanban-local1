import type { Project, Task } from '@shared/schema';
import type { DaySheetSectionGroup } from '@shared/day-sheet';
import { TASK_PRIORITY, TASK_PRIORITY_LABEL, type TaskPriorityValue } from '@shared/constants';

export interface DaySheetProps {
  /** Do now, Next, Later, as `buildDaySheet` returns them. */
  groups: DaySheetSectionGroup[];
  /** Lines to print per group; a group not listed prints in full. */
  shown?: readonly number[];
  /** "Friday 6 November 2026". */
  dateLabel: string;
  /** What is narrowing the board, or null when nothing is. */
  scopeLabel: string | null;
  /** "6 Nov 2026 at 9:14 am". */
  printedLabel: string;
  projectById: (id: number | null | undefined) => Project | null;
  /** Body size in pt; every other size is relative to it. */
  sizePt: number;
}

/**
 * The page itself: a heading with the date, a line naming what the board was
 * narrowed to, then Do now, Next and Later, each a list of tick lines. Black
 * on white with rules only, so it reads the same off a mono laser printer.
 * Styles in `day-sheet.css`.
 */
export function DaySheet({
  groups,
  shown,
  dateLabel,
  scopeLabel,
  printedLabel,
  projectById,
  sizePt,
}: DaySheetProps) {
  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  return (
    <article
      className="day-sheet"
      style={{ fontSize: `${sizePt}pt` }}
      data-testid="day-sheet"
      data-size-pt={sizePt}
    >
      <header className="ds-head">
        <h1 className="ds-title">Day sheet</h1>
        <p className="ds-date">{dateLabel}</p>
      </header>
      <p className="ds-scope" data-testid="day-sheet-scope">
        {scopeLabel ? `Showing ${scopeLabel}.` : 'Showing everything on the board.'}
      </p>

      {groups.map((group, index) => {
        const count = shown?.[index] ?? group.tasks.length;
        const lines = group.tasks.slice(0, count);
        const more = group.tasks.length - lines.length;
        return (
          <section
            key={group.section}
            className="ds-section"
            data-testid={`day-sheet-section-${group.section}`}
          >
            <h2 className="ds-section-head">
              <span>{group.label}</span>
              <span className="ds-count">{group.tasks.length}</span>
            </h2>
            {group.tasks.length === 0 ? (
              <p className="ds-empty">Nothing here.</p>
            ) : (
              <ul className="ds-lines">
                {lines.map((task) => (
                  <DaySheetLine key={task.id} task={task} projectById={projectById} />
                ))}
              </ul>
            )}
            {more > 0 && (
              <p className="ds-more" data-testid={`day-sheet-more-${group.section}`}>
                + {more} more on the board
              </p>
            )}
          </section>
        );
      })}

      <footer className="ds-foot">
        Printed {printedLabel}. {total} {total === 1 ? 'task' : 'tasks'}.
      </footer>
    </article>
  );
}

function DaySheetLine({
  task,
  projectById,
}: {
  task: Task;
  projectById: DaySheetProps['projectById'];
}) {
  const priority = (task.priority ?? TASK_PRIORITY.NORMAL) as TaskPriorityValue;
  const project = projectById(task.projectId);
  return (
    <li className="ds-line" data-testid={`day-sheet-line-${task.id}`}>
      <span className="ds-box" aria-hidden />
      <span className="ds-task">{task.title}</span>
      <span className="ds-meta">
        {/* The app's own priority mark: the word in an outlined badge, nothing
            for Normal (TaskCard, TaskPreviewPane). */}
        {priority !== TASK_PRIORITY.NORMAL && TASK_PRIORITY_LABEL[priority] && (
          <span className={`ds-priority ds-priority-${priority}`}>
            {TASK_PRIORITY_LABEL[priority]}
          </span>
        )}
        <span className="ds-id">#{task.id}</span>
        {project && <span className="ds-project">{project.key ?? project.name}</span>}
      </span>
    </li>
  );
}
