/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTaskSchema, type InsertTask } from '@shared/schema';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_PRIORITY_LABEL,
  TASK_RECURRENCE,
  EFFORT_MIN,
  EFFORT_MAX,
  getStatusFromStageName,
  type TaskPriorityValue,
} from '@shared/constants';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { useStages } from '@/hooks/use-stages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateTaskDialogProps {
  iconOnly?: boolean;
}

export function CreateTaskDialog({ iconOnly = false }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createTask = useCreateTask();

  const { data: stages = [] } = useStages();

  const defaultStageId = stages[0]?.id || 1;

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      stageId: defaultStageId,
      status: TASK_STATUS.BACKLOG,
      priority: TASK_PRIORITY.NORMAL,
      recurrence: TASK_RECURRENCE.NONE,
    },
  });

  const onSubmit = (data: InsertTask) => {
    const selectedStage = stages.find((s: any) => s.id === data.stageId);
    let status = data.status;
    if (!status && selectedStage) {
      status = getStatusFromStageName(selectedStage.name);
    }

    createTask.mutate(
      { ...data, status: status || TASK_STATUS.BACKLOG },
      {
        onSuccess: () => {
          if ('vibrate' in navigator) navigator.vibrate(10);
          toast({ title: 'Task created', description: 'Your new task has been added.' });
          setOpen(false);
          form.reset({
            stageId: defaultStageId,
            title: '',
            description: '',
            status: TASK_STATUS.BACKLOG,
            priority: TASK_PRIORITY.NORMAL,
            recurrence: TASK_RECURRENCE.NONE,
          });
        },
        onError: (error) => {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            className="flex flex-col items-center gap-1 -mt-4 relative"
            data-testid="button-add-task"
          >
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform">
              <Plus className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium">Add</span>
          </button>
        ) : (
          <Button
            className="gap-2 rounded-xl active:scale-95 transition-transform w-full"
            data-testid="button-add-task"
          >
            <Plus className="h-5 w-5" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg">Create New Task</DialogTitle>
            <DialogDescription className="text-xs">Add a new task to your board.</DialogDescription>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 flex flex-col gap-4 overflow-y-auto"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Design homepage"
                      {...field}
                      className="h-12 text-base rounded-xl"
                      data-testid="input-task-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Stage</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(Number(v));
                    }}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select stage" />
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
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add details..."
                      className="resize-none rounded-xl text-base"
                      rows={4}
                      {...field}
                      value={field.value || ''}
                      data-testid="input-task-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || TASK_PRIORITY.NORMAL}
                    >
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

              <FormField
                control={form.control}
                name="effort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Effort ({EFFORT_MIN}-{EFFORT_MAX})
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-1.5">
                        {Array.from(
                          { length: EFFORT_MAX - EFFORT_MIN + 1 },
                          (_, i) => EFFORT_MIN + i,
                        ).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => field.onChange(val)}
                            className={cn(
                              'flex-1 h-12 rounded-xl text-base font-semibold transition-colors',
                              field.value === val
                                ? 'bg-primary text-primary-foreground neo-raised'
                                : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary',
                            )}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Spacer to push button to bottom */}
            <div className="flex-1" />

            <div className="flex gap-3 pt-4 pb-safe-bottom sticky bottom-0 bg-background">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTask.isPending}
                className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
                data-testid="button-submit-task"
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
