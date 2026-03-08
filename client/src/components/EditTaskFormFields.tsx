/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Control } from 'react-hook-form';
import type { InsertTask } from '@shared/schema';
import type { Stage } from '@shared/schema';
import {
  TASK_STATUS,
  TASK_STATUS_LABEL,
  TASK_PRIORITY,
  TASK_PRIORITY_LABEL,
  EFFORT_MIN,
  EFFORT_MAX,
  type TaskStatusValue,
  type TaskPriorityValue,
} from '@shared/constants';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface EditTaskFormFieldsProps {
  control: Control<InsertTask>;
  stages: Stage[];
}

export function EditTaskFormFields({ control, stages }: EditTaskFormFieldsProps) {
  return (
    <>
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Title</FormLabel>
            <FormControl>
              <Input
                {...field}
                className="h-12 text-base rounded-xl"
                data-testid="input-edit-title"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="stageId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Stage</FormLabel>
            <Select
              onValueChange={(v) => {
                field.onChange(Number(v));
              }}
              value={field.value?.toString()}
            >
              <FormControl>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {stages.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()} className="py-3">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Description</FormLabel>
            <FormControl>
              <Textarea
                className="resize-none rounded-xl text-base"
                rows={5}
                {...field}
                value={field.value || ''}
                data-testid="input-edit-description"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || TASK_STATUS.BACKLOG}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.values(TASK_STATUS) as TaskStatusValue[]).map((status) => (
                    <SelectItem key={status} value={status} className="py-3">
                      {TASK_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Priority</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || TASK_PRIORITY.NORMAL}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.values(TASK_PRIORITY) as TaskPriorityValue[]).map((priority) => (
                    <SelectItem key={priority} value={priority} className="py-3">
                      {TASK_PRIORITY_LABEL[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="effort"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Effort ({EFFORT_MIN}-{EFFORT_MAX})
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={EFFORT_MIN}
                  max={EFFORT_MAX}
                  className="h-12 rounded-xl text-base"
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => {
                    field.onChange(e.target.value ? parseInt(e.target.value) : undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Due Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full h-12 justify-start text-left font-normal rounded-xl',
                        !field.value && 'text-muted-foreground',
                      )}
                    >
                      {field.value && field.value instanceof Date && !isNaN(field.value.getTime())
                        ? format(field.value, 'MMM d')
                        : 'Pick date'}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    selected={field.value ?? undefined}
                    onSelect={(date: Date | undefined) => {
                      field.onChange(date || undefined);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
