import { useEffect, useMemo } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { X } from 'lucide-react';
import type { InsertTask, Task } from '@shared/schema';
import { reachable } from '@shared/task-dependencies';
import { TASK_TYPE } from '@shared/constants';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTasks, useTaskDependencies } from '@/hooks/use-tasks';

type Side = 'predecessorIds' | 'successorIds';

interface PickerProps {
  control: Control<InsertTask>;
  name: Side;
  label: string;
  hint: string;
  testId: string;
  /** Tasks that may be chosen. */
  options: Task[];
  /** What the saved task already has, shown until the user edits this side. */
  saved: number[];
  titleOf: (id: number) => string;
  /** Whether a linked task is in the project this task is (becoming) in. */
  fits: (id: number) => boolean;
  /** Greyed out and read-only (the task is a goal). */
  disabled: boolean;
}

function DependencyPicker({
  control,
  name,
  label,
  hint,
  testId,
  options,
  saved,
  titleOf,
  fits,
  disabled,
}: PickerProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // undefined = untouched, so the saved edges show and none are sent.
        const current: number[] = (field.value ?? saved).filter(fits);
        const pruned = (field.value ?? saved).length - current.length;
        const set = (next: number[]) => {
          field.onChange(next);
        };
        const toggle = (id: number) => {
          set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
        };
        return (
          <FormItem className={disabled ? 'opacity-50' : undefined} aria-disabled={disabled}>
            <PruneToProject
              pruned={disabled ? 0 : pruned}
              untouched={field.value === undefined}
              current={current}
              onPrune={set}
            />
            <FormLabel className="text-xs">{label}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-start rounded-md font-normal"
                    disabled={disabled}
                    data-testid={testId}
                  >
                    {current.length === 0 ? hint : `${current.length} selected — edit`}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent
                className="max-h-[min(18rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto overscroll-contain"
                align="start"
                collisionPadding={12}
                // The popover is portalled outside the edit dialog, whose scroll
                // lock swallows wheel and touch scrolling anywhere else. Keeping
                // the events inside the list lets it scroll.
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                }}
              >
                {options.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other tasks can be linked.</p>
                ) : (
                  <ul className="space-y-1">
                    {options.map((t) => (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={current.includes(t.id)}
                            onChange={() => {
                              toggle(t.id);
                            }}
                          />
                          <span>
                            <span className="text-muted-foreground">#{t.id}</span> {t.title}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
            {current.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={label}>
                {current.map((id) => (
                  <li
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    <span className="max-w-[12rem] truncate">
                      #{id} {titleOf(id)}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      className="disabled:cursor-not-allowed"
                      aria-label={`Remove ${titleOf(id)}`}
                      onClick={() => {
                        set(current.filter((x) => x !== id));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pruned > 0 && (
              <p className="text-xs text-muted-foreground">
                {pruned} link{pruned > 1 ? 's' : ''} to other projects will be removed on save.
              </p>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * When the task's project changes, links to tasks left behind cannot stay.
 * Writing the surviving set into the form makes the save replace the side
 * (which the server needs in order to accept the move).
 */
function PruneToProject({
  pruned,
  untouched,
  current,
  onPrune,
}: {
  pruned: number;
  untouched: boolean;
  current: number[];
  onPrune: (next: number[]) => void;
}) {
  useEffect(() => {
    if (pruned > 0 && untouched) onPrune(current);
  }, [pruned, untouched]);
  return null;
}

/**
 * Predecessors (must finish before this task) and successors (wait for this
 * task). Many-to-many: a task can have any number of each. Options that would
 * close a loop are left out; the server re-checks and is the authority.
 * `taskId` is absent while creating, when there is nothing saved yet.
 */
export function TaskDependenciesField({
  control,
  taskId,
}: {
  control: Control<InsertTask>;
  taskId?: number;
}) {
  const { data: tasks = [] } = useTasks();
  const { data: edges = [] } = useTaskDependencies();
  const projectId = useWatch({ control, name: 'projectId' }) ?? null;
  // A goal is ordered through its building-blocks, not by links of its own.
  const isGoal = useWatch({ control, name: 'type' }) === TASK_TYPE.GOAL;

  const { predOptions, succOptions, savedPreds, savedSuccs } = useMemo(() => {
    // Only tasks in the same project can be linked; "no project" is a project of its own.
    const live = tasks.filter(
      (t) =>
        !t.archived &&
        t.deletedAt == null &&
        t.id !== taskId &&
        (t.projectId ?? null) === projectId,
    );
    const below = taskId === undefined ? new Set<number>() : reachable(edges, taskId, 'successors');
    const above =
      taskId === undefined ? new Set<number>() : reachable(edges, taskId, 'predecessors');
    return {
      // A predecessor cannot already be downstream of this task, and vice versa.
      predOptions: live.filter((t) => !below.has(t.id)),
      succOptions: live.filter((t) => !above.has(t.id)),
      savedPreds: edges.filter((e) => e.successorId === taskId).map((e) => e.predecessorId),
      savedSuccs: edges.filter((e) => e.predecessorId === taskId).map((e) => e.successorId),
    };
  }, [tasks, edges, taskId, projectId]);
  const fits = (id: number) => {
    const t = tasks.find((x) => x.id === id);
    return t ? (t.projectId ?? null) === projectId : true;
  };

  const titleOf = (id: number) => tasks.find((t) => t.id === id)?.title ?? 'Unknown task';

  return (
    <div className="space-y-1.5" data-testid="task-dependencies">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DependencyPicker
          control={control}
          name="predecessorIds"
          label="Predecessors"
          hint="Must finish before this task"
          testId="task-predecessors"
          options={predOptions}
          saved={savedPreds}
          titleOf={titleOf}
          fits={fits}
          disabled={isGoal}
        />
        <DependencyPicker
          control={control}
          name="successorIds"
          label="Successors"
          hint="Wait for this task"
          testId="task-successors"
          options={succOptions}
          saved={savedSuccs}
          titleOf={titleOf}
          fits={fits}
          disabled={isGoal}
        />
      </div>
      {isGoal && (
        <p className="text-xs text-muted-foreground" data-testid="dependencies-goal-note">
          Not used for a goal: its order comes from its building-blocks and their predecessors and
          successors.
        </p>
      )}
    </div>
  );
}
