/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import type { InsertTask } from '@shared/schema';
import type { Stage } from '@shared/schema';
import { useSubStages } from '@/hooks/use-stages';
import { useProjectScope } from '@/hooks/use-project-scope';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_LABEL,
  STAGE_KIND_LABEL,
  EFFORT_MIN,
  EFFORT_MAX,
  type TaskPriorityValue,
} from '@shared/constants';
import { stageKind } from '@shared/stage-state';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { VoiceInput } from '@/components/VoiceInput';
import { appendTranscript } from '@/lib/dictation';
import { RichTextEditor } from '@/components/RichTextEditor';
import { RichTextContent } from '@/components/RichTextContent';
import { isRichTextEmpty } from '@/lib/rich-text';
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
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OwnerSelector } from './OwnerSelector';
import { ProjectSelect } from './ProjectSelect';

export interface EditTaskFormFieldsProps {
  control: Control<InsertTask>;
  stages: Stage[];
}

const NO_SUB_STAGE = '__none__';

export function EditTaskFormFields({ control, stages }: EditTaskFormFieldsProps) {
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const { data: allSubStages = [] } = useSubStages();
  const { projects } = useProjectScope();
  const selectedStageId = useWatch({ control, name: 'stageId' });
  const selectedProjectId = useWatch({ control, name: 'projectId' });
  // Blank tags exist in pre-validation data; they can't be selected (a Radix
  // SelectItem value must be a non-empty string) so leave them out entirely.
  const stageSubStages = allSubStages
    .filter((ss) => ss.stageId === selectedStageId && ss.tag.trim() !== '')
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Title</FormLabel>
            <FormControl>
              <VoiceInput
                {...field}
                onDictate={(transcript) => {
                  field.onChange(appendTranscript(field.value, transcript));
                }}
                fieldLabel="title"
                className="h-12 text-base rounded-md"
                data-testid="input-edit-title"
                micTestId="button-dictate-edit-title"
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
                <SelectTrigger className="h-12 rounded-md">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {stages.map((s: any) => {
                  // This picker sets the task's state now that Status is gone,
                  // so each row names the state it means. The kind is shown
                  // only where it adds something the column name does not
                  // already say.
                  const kindLabel = STAGE_KIND_LABEL[stageKind(s)];
                  const nameSaysIt = s.name.toLowerCase().includes(kindLabel.toLowerCase());
                  return (
                    <SelectItem key={s.id} value={s.id.toString()} className="py-3">
                      {s.name}
                      {!nameSaysIt && (
                        <span className="ml-2 text-[11px] text-muted-foreground">{kindLabel}</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {(projects.length > 0 || selectedProjectId != null) && (
        <FormField
          control={control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Project</FormLabel>
              <FormControl>
                <ProjectSelect
                  value={field.value}
                  onChange={(next) => field.onChange(next)}
                  data-testid="select-edit-project"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {stageSubStages.length > 0 && (
        <FormField
          control={control}
          name="tags"
          render={({ field }) => {
            const tags: string[] = Array.isArray(field.value) ? field.value : [];
            // Mirror the board: the task's sub-stage is its most recently
            // assigned matching tag; tasks without one sit in the first
            // (catch-all) sub-stage.
            const currentTag =
              [...tags].reverse().find((tag) => stageSubStages.some((ss) => ss.tag === tag)) ??
              NO_SUB_STAGE;
            const allSubStageTags = allSubStages.map((ss) => ss.tag);
            return (
              <FormItem>
                <FormLabel className="text-xs">Sub-stage</FormLabel>
                <Select
                  value={currentTag}
                  onValueChange={(value) => {
                    const kept = tags.filter((tag) => !allSubStageTags.includes(tag));
                    field.onChange(value === NO_SUB_STAGE ? kept : [...kept, value]);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-md" data-testid="select-edit-substage">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_SUB_STAGE} className="py-3">
                      None
                    </SelectItem>
                    {stageSubStages.map((ss) => (
                      <SelectItem key={ss.id} value={ss.tag} className="py-3">
                        {ss.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className="text-xs">Description</FormLabel>
              <button
                type="button"
                onClick={() => setEditingDescription((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary font-medium rounded-lg px-2 py-1 hover:bg-muted transition-colors"
                data-testid="button-toggle-description-edit"
              >
                {editingDescription ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </>
                )}
              </button>
            </div>
            <FormControl>
              {editingDescription ? (
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  data-testid="input-edit-description"
                />
              ) : isRichTextEmpty(field.value) ? (
                <button
                  type="button"
                  onClick={() => setEditingDescription(true)}
                  className="w-full text-left neo-input rounded-md px-4 py-3 min-h-[64px] text-base text-muted-foreground italic bg-card"
                  data-testid="text-edit-description"
                >
                  Tap to add a description...
                </button>
              ) : (
                // Read mode: links open in a new tab, image chips open a preview.
                <div className="neo-input rounded-md px-4 py-3 bg-card">
                  <RichTextContent
                    value={field.value}
                    className="text-base"
                    data-testid="text-edit-description"
                  />
                </div>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* No Status field. It was a second state machine a user could set
          independently of the column the card sat in, which is how tasks came
          to read "Done" in Backlog (EPIC-03 finding #1). Move the card — or
          change its Stage above — and the state follows. */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Priority</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || TASK_PRIORITY.NORMAL}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-md">
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

      <FormField
        control={control}
        name="ownerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Owner</FormLabel>
            <FormControl>
              <OwnerSelector value={field.value} onChange={(next) => field.onChange(next)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
                        'flex-1 h-12 rounded-md text-base font-semibold transition-colors',
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

        <FormField
          control={control}
          name="dueDate"
          render={({ field }) => {
            const hasDate =
              field.value && field.value instanceof Date && !isNaN(field.value.getTime());
            return (
              <FormItem>
                <FormLabel className="text-xs">Due Date</FormLabel>
                <div className="flex gap-1.5">
                  <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'flex-1 h-12 justify-start text-left font-normal rounded-md',
                            !hasDate && 'text-muted-foreground',
                          )}
                        >
                          {hasDate ? format(field.value!, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date: Date | undefined) => {
                          field.onChange(date ?? null);
                          setDueDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {hasDate && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-md shrink-0"
                      onClick={() => field.onChange(null)}
                      aria-label="Clear due date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </>
  );
}
