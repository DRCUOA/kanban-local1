import type { Control } from 'react-hook-form';
import type { InsertTask } from '@shared/schema';
import { TASK_TYPE_LABEL, TASK_TYPE_VALUES, type TaskTypeValue } from '@shared/constants';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Radix Select cannot hold an empty string, so "unset" travels as this value.
const UNSET = 'unset';

export function TaskTypeField({ control }: { control: Control<InsertTask> }) {
  return (
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
  );
}
