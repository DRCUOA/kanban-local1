import { useWatch, type Control } from 'react-hook-form';
import type { InsertTask } from '@shared/schema';
import {
  TASK_TYPE,
  TASK_TYPE_LABEL,
  TASK_TYPE_VALUES,
  type TaskTypeValue,
} from '@shared/constants';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTasks } from '@/hooks/use-tasks';

// Radix Select cannot hold an empty string, so "unset" travels as this value.
const UNSET = 'unset';

/**
 * The Type selector and, when the type is `building-block`, the Goal selector:
 * the goal task this block contributes to (`goalTaskId`). Choosing any other
 * type clears the goal, mirroring the server rule.
 */
export function TaskTypeField({ control }: { control: Control<InsertTask> }) {
  const type = useWatch({ control, name: 'type' });
  const projectId = useWatch({ control, name: 'projectId' }) ?? null;
  const { data: allTasks = [] } = useTasks();
  const goals = allTasks.filter(
    (t) =>
      t.type === TASK_TYPE.GOAL &&
      !t.archived &&
      t.deletedAt == null &&
      // A goal in a project only takes blocks from that project; one with no
      // project is cross-cutting and takes any.
      (t.projectId == null || t.projectId === projectId),
  );

  return (
    <>
      <FormField
        control={control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Type</FormLabel>
            <Select
              onValueChange={(v) => {
                field.onChange(v === UNSET ? null : v);
              }}
              value={field.value ?? UNSET}
            >
              <FormControl>
                <SelectTrigger className="h-12 rounded-md" data-testid="task-type-select">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={UNSET} className="py-3">
                  Not set
                </SelectItem>
                {TASK_TYPE_VALUES.map((t: TaskTypeValue) => (
                  <SelectItem key={t} value={t} className="py-3">
                    {TASK_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {type === TASK_TYPE.BUILDING_BLOCK && (
        <FormField
          control={control}
          name="goalTaskId"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel className="text-xs">Goal</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v === UNSET ? null : Number(v));
                }}
                value={field.value != null ? String(field.value) : UNSET}
              >
                <FormControl>
                  <SelectTrigger className="h-12 rounded-md" data-testid="task-goal-select">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={UNSET} className="py-3">
                    No goal yet
                  </SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)} className="py-3">
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {goals.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No goals available for this project. Create a task with type Goal first.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
