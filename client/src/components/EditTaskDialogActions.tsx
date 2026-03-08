/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Button } from '@/components/ui/button';
import { Trash2, History } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface EditTaskDialogActionsProps {
  onViewHistory?: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditTaskDialogActions({
  onViewHistory,
  onDelete,
  onCancel,
  isSaving,
}: EditTaskDialogActionsProps) {
  return (
    <div className="flex flex-col gap-3 pt-4 pb-safe-bottom sticky bottom-0 bg-background">
      <div className="flex gap-2">
        {onViewHistory && (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl flex-1"
            onClick={onViewHistory}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="h-12 rounded-xl flex-1"
              data-testid="button-delete-task"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="mx-4 rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg">Delete task?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-3">
              <AlertDialogCancel className="flex-1 h-12 rounded-xl m-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="flex-1 h-12 rounded-xl m-0 bg-destructive text-destructive-foreground active:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-12 rounded-xl"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
          data-testid="button-save-task"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
