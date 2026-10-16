/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, History, Share2, Sparkles, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface EditTaskDialogActionsProps {
  onViewHistory?: () => void;
  /** Opens the share dialog for the task; omitted when no task is loaded. */
  onShare?: () => void;
  /** "Make this a goal": the dialog validates (saved, type Goal) before anything is called. */
  onMakeGoal?: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const menuItem =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors hover:bg-accent active:bg-accent';

/**
 * The dialog footer is one row — More, Cancel, Save — so Save is always in
 * reach and the row never overflows a phone. The rarer task actions (goal
 * plan, history, share, delete) sit behind More; Delete still asks first.
 */
export function EditTaskDialogActions({
  onViewHistory,
  onShare,
  onMakeGoal,
  onDelete,
  onCancel,
  isSaving,
}: EditTaskDialogActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = (action?: () => void) => () => {
    setMenuOpen(false);
    action?.();
  };

  return (
    <div className="sticky bottom-0 flex items-center gap-2 bg-background pt-3 pb-safe-bottom">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 flex-shrink-0 rounded-md p-0"
            aria-label="More task actions"
            data-testid="button-task-more"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-64 p-1">
          {onMakeGoal && (
            <button
              type="button"
              className={`${menuItem} text-primary`}
              onClick={run(onMakeGoal)}
              data-testid="button-make-goal"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Make this a goal
            </button>
          )}
          {onViewHistory && (
            <button type="button" className={menuItem} onClick={run(onViewHistory)}>
              <History className="h-4 w-4" aria-hidden />
              History
            </button>
          )}
          {onShare && (
            <button
              type="button"
              className={menuItem}
              onClick={run(onShare)}
              data-testid="button-share-task"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>
          )}
          <button
            type="button"
            className={`${menuItem} text-destructive`}
            onClick={run(() => {
              setConfirmOpen(true);
            })}
            data-testid="button-delete-task"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </button>
        </PopoverContent>
      </Popover>

      <Button type="button" variant="outline" className="h-12 flex-1 rounded-md" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={isSaving}
        className="h-12 flex-1 rounded-md active:scale-95 transition-transform"
        data-testid="button-save-task"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="mx-4 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Delete task?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3">
            <AlertDialogCancel className="m-0 h-12 flex-1 rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="m-0 h-12 flex-1 rounded-md bg-destructive text-destructive-foreground active:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
