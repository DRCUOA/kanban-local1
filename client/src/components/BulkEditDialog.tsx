import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Layers } from 'lucide-react';
import type { Stage, Task } from '@shared/schema';
import {
  EFFORT_MAX,
  EFFORT_MIN,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VALUES,
  TASK_RECURRENCE,
  TASK_TYPE,
  TASK_TYPE_LABEL,
  TASK_TYPE_VALUES,
} from '@shared/constants';
import { BULK_FIELDS, BULK_FIELD_LABEL, type BulkField } from '@shared/bulk-edit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OwnerSelector } from '@/components/OwnerSelector';
import { ProjectSelect } from '@/components/ProjectSelect';
import { useBulkUpdateTasks, useTasks } from '@/hooks/use-tasks';
import { useOwners } from '@/hooks/use-owners';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Radix Select cannot hold an empty string, so "none" travels as this value.
const NONE = '__none__';

const RECURRENCE_LABEL: Record<string, string> = {
  [TASK_RECURRENCE.NONE]: 'Does not repeat',
  [TASK_RECURRENCE.DAILY]: 'Daily',
  [TASK_RECURRENCE.WEEKLY]: 'Weekly',
  [TASK_RECURRENCE.MONTHLY]: 'Monthly',
};

/**
 * Edit many tasks at once: the task form's fields, of which one is chosen and
 * set to one value on every selected task. The server applies it to all of
 * them or none, with the same rules a single save uses, and names the task
 * that breaks one.
 */
export function BulkEditDialog({
  tasks,
  stages,
  open,
  onOpenChange,
  onDone,
}: {
  tasks: Task[];
  stages: Stage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a successful update (the board clears its selection). */
  onDone: () => void;
}) {
  const { toast } = useToast();
  const bulk = useBulkUpdateTasks();
  const { data: allTasks = [] } = useTasks();
  const { data: owners = [] } = useOwners();
  const { projectById } = useProjectScope();
  const [field, setField] = useState<BulkField | null>(null);
  /** A stage/project/goal/owner id or effort, a priority/type/recurrence key, a date as ISO text, or null to clear. */
  const [value, setValue] = useState<string | number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setField(null);
      setValue(undefined);
      setError(null);
    }
  }, [open]);

  // Goals a block in these tasks' project could join: one shared project, or
  // goals with no project (which take blocks from anywhere).
  const sharedProject = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.projectId ?? null));
    return ids.size === 1 ? [...ids][0] : undefined;
  }, [tasks]);
  const goals = allTasks.filter(
    (t) =>
      t.type === TASK_TYPE.GOAL &&
      !t.archived &&
      t.deletedAt == null &&
      !tasks.some((s) => s.id === t.id) &&
      (t.projectId == null || t.projectId === sharedProject),
  );

  const choose = (next: BulkField) => {
    setField(next);
    setError(null);
    setValue(next === 'stageId' ? undefined : next === 'dueDate' ? null : undefined);
  };

  const describeValue = (): string | null => {
    if (!field || value === undefined) return null;
    switch (field) {
      case 'stageId':
        return stages.find((s) => s.id === value)?.name.trim() ?? null;
      case 'projectId':
        return value === null ? 'No project' : (projectById(value as number)?.name ?? null);
      case 'priority':
        return TASK_PRIORITY_LABEL[value as keyof typeof TASK_PRIORITY_LABEL];
      case 'type':
        return value === null ? 'Not set' : TASK_TYPE_LABEL[value as keyof typeof TASK_TYPE_LABEL];
      case 'goalTaskId':
        return value === null
          ? 'No goal'
          : (goals.find((g) => g.id === value)?.title ?? `#${String(value)}`);
      case 'ownerId':
        return value === null
          ? 'Unassigned'
          : (owners.find((o) => o.id === value)?.name ?? `#${String(value)}`);
      case 'effort':
        return value === null ? 'No effort' : String(value);
      case 'dueDate':
        return value === null ? 'No due date' : format(new Date(value as string), 'd MMM yyyy');
      case 'recurrence':
        return RECURRENCE_LABEL[value as string] ?? String(value);
    }
  };

  const summary = describeValue();
  const n = tasks.length;

  const apply = () => {
    if (!field || value === undefined) return;
    setError(null);
    bulk.mutate(
      { ids: tasks.map((t) => t.id), field, value },
      {
        onSuccess: ({ updated }) => {
          toast({
            title: `Updated ${updated} task${updated === 1 ? '' : 's'}`,
            description: `${BULK_FIELD_LABEL[field]} set to ${summary ?? 'the new value'}.`,
          });
          onOpenChange(false);
          onDone();
        },
        onError: (e) => {
          setError(e.message.replace(/^\d+:\s*/, ''));
        },
      },
    );
  };

  const selectRow = (
    current: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
    placeholder: string,
  ) => (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-12 rounded-md">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-3">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const input = (f: BulkField) => {
    switch (f) {
      case 'stageId':
        return selectRow(
          value === undefined ? '' : String(value),
          (v) => {
            setValue(Number(v));
          },
          [...stages]
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ value: String(s.id), label: s.name.trim() })),
          'Choose a stage',
        );
      case 'projectId':
        return (
          <ProjectSelect
            value={value === undefined ? undefined : (value as number | null)}
            onChange={(next) => {
              setValue(next);
            }}
          />
        );
      case 'priority':
        return selectRow(
          (value as string | undefined) ?? '',
          setValue,
          TASK_PRIORITY_VALUES.map((p) => ({ value: p, label: TASK_PRIORITY_LABEL[p] })),
          'Choose a priority',
        );
      case 'type':
        return selectRow(
          value === undefined ? '' : value === null ? NONE : String(value),
          (v) => {
            setValue(v === NONE ? null : v);
          },
          [
            { value: NONE, label: 'Not set' },
            ...TASK_TYPE_VALUES.map((t) => ({ value: t, label: TASK_TYPE_LABEL[t] })),
          ],
          'Choose a type',
        );
      case 'goalTaskId':
        return (
          <div className="space-y-1.5">
            {selectRow(
              value === undefined ? '' : value === null ? NONE : String(value),
              (v) => {
                setValue(v === NONE ? null : Number(v));
              },
              [
                { value: NONE, label: 'No goal' },
                ...goals.map((g) => ({ value: String(g.id), label: g.title })),
              ],
              'Choose a goal',
            )}
            <p className="text-xs text-muted-foreground">
              Tasks with no type become building-blocks of the goal.
              {sharedProject === undefined &&
                ' These tasks are in different projects, so only goals with no project are offered.'}
            </p>
          </div>
        );
      case 'ownerId':
        return (
          <OwnerSelector
            value={value === undefined ? undefined : (value as number | null)}
            onChange={(next) => {
              setValue(next);
            }}
            placeholder="Choose an owner"
          />
        );
      case 'effort':
        return (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: EFFORT_MAX - EFFORT_MIN + 1 }, (_, i) => i + EFFORT_MIN).map(
              (e) => (
                <Button
                  key={e}
                  type="button"
                  variant={value === e ? 'default' : 'outline'}
                  aria-pressed={value === e}
                  className="h-12 w-12"
                  onClick={() => {
                    setValue(e);
                  }}
                >
                  {e}
                </Button>
              ),
            )}
            <Button
              type="button"
              variant={value === null ? 'default' : 'outline'}
              aria-pressed={value === null}
              className="h-12"
              onClick={() => {
                setValue(null);
              }}
            >
              Clear
            </Button>
          </div>
        );
      case 'dueDate':
        return (
          <div className="flex gap-2">
            <Input
              type="date"
              aria-label="Due date"
              className="h-12"
              value={typeof value === 'string' ? format(new Date(value), 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                // Local midnight, as the task form's date picker stores it.
                const [y, m, d] = e.target.value.split('-').map(Number);
                setValue(y && m && d ? new Date(y, m - 1, d).toISOString() : null);
              }}
            />
            <Button
              type="button"
              variant={value === null ? 'default' : 'outline'}
              className="h-12"
              onClick={() => {
                setValue(null);
              }}
            >
              No due date
            </Button>
          </div>
        );
      case 'recurrence':
        return selectRow(
          (value as string | undefined) ?? '',
          setValue,
          Object.values(TASK_RECURRENCE).map((r) => ({
            value: r,
            label: RECURRENCE_LABEL[r] ?? r,
          })),
          'Choose how it repeats',
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-xl"
        data-testid="bulk-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-4 w-4 text-primary" aria-hidden />
            Edit {n} task{n === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose one field and the value to give every selected task. Everything else stays as it
            is.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" aria-label="Selected tasks">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="max-w-[14rem] truncate rounded-full border px-2 py-0.5 text-xs"
            >
              #{t.id} {t.title}
            </li>
          ))}
        </ul>

        <div
          className="flex-1 space-y-2 overflow-y-auto pr-1"
          role="radiogroup"
          aria-label="Field to change"
        >
          {BULK_FIELDS.map((f) => {
            const on = field === f;
            return (
              <div
                key={f}
                className={cn('rounded-md border p-3', on && 'border-primary bg-primary/5')}
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="bulk-field"
                    checked={on}
                    onChange={() => {
                      choose(f);
                    }}
                    data-testid={`bulk-field-${f}`}
                  />
                  {BULK_FIELD_LABEL[f]}
                </label>
                {on && <div className="mt-3">{input(f)}</div>}
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger" data-testid="bulk-edit-error">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-xs text-muted-foreground" aria-live="polite">
            {field && summary
              ? `Set ${BULK_FIELD_LABEL[field]} to ${summary} on ${n} task${n === 1 ? '' : 's'}.`
              : 'Nothing chosen yet.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!field || summary === null || bulk.isPending}
            onClick={apply}
            data-testid="bulk-edit-apply"
          >
            {bulk.isPending ? 'Updating…' : `Update ${n} task${n === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
