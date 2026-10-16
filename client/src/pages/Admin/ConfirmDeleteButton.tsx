import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/**
 * A delete icon button that asks first. Deleting a stage or sub-stage is not
 * undoable from the board, so nothing is sent until the dialog is confirmed.
 */
export function ConfirmDeleteButton({
  name,
  description,
  disabled,
  testId,
  onConfirm,
}: {
  /** What is being deleted, e.g. "In Progress"; names the button and the dialog. */
  name: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="destructive"
        size="icon"
        className="h-11 w-11 rounded-md"
        onClick={() => {
          setOpen(true);
        }}
        disabled={disabled}
        aria-label={`Delete ${name}`}
        data-testid={testId}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="mx-4 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {description ?? 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3">
            <AlertDialogCancel className="m-0 h-12 flex-1 rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="m-0 h-12 flex-1 rounded-md bg-destructive text-destructive-foreground active:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
