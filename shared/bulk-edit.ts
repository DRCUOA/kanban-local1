import { z } from 'zod';
import { insertTaskSchema } from './schema';

/**
 * Bulk edit: one field, set to one value, on every selected task. The fields
 * are the task form's that make sense for many tasks at once; title,
 * description and dependencies are one task's own and are left out.
 */
export const BULK_FIELDS = [
  'stageId',
  'projectId',
  'priority',
  'type',
  'goalTaskId',
  'ownerId',
  'effort',
  'dueDate',
  'recurrence',
] as const;
export type BulkField = (typeof BULK_FIELDS)[number];

export const BULK_FIELD_LABEL: Record<BulkField, string> = {
  stageId: 'Stage',
  projectId: 'Project',
  priority: 'Priority',
  type: 'Type',
  goalTaskId: 'Goal',
  ownerId: 'Owner',
  effort: 'Effort',
  dueDate: 'Due date',
  recurrence: 'Recurrence',
};

export const BULK_MAX_TASKS = 500;

export const bulkUpdateRequestSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(BULK_MAX_TASKS),
  field: z.enum(BULK_FIELDS),
  value: z.unknown(),
});
export type BulkUpdateRequest = z.infer<typeof bulkUpdateRequestSchema>;

/**
 * The validated change, as a task update with exactly the one key, using the
 * same rules as the task form (insertTaskSchema). Throws a ZodError when the
 * value is not valid for the field.
 */
export function bulkChange(field: BulkField, value: unknown): Record<string, unknown> {
  const parsed = insertTaskSchema.pick({ [field]: true } as Record<BulkField, true>).parse({
    [field]: value,
  }) as Record<string, unknown>;
  // `stageId` is required by the form; everything else may be cleared with null.
  if (!(field in parsed)) {
    throw new z.ZodError([
      { code: 'custom', path: [field], message: `Choose a value for ${BULK_FIELD_LABEL[field]}` },
    ]);
  }
  return { [field]: parsed[field] };
}

export interface BulkUpdateResult {
  updated: number;
}
