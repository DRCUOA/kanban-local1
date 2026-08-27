import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useDeletedTasks, useRestoreTask, useDeleteTask } from '@/hooks/use-tasks';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { richTextToPlainText } from '@/lib/rich-text';
import { ROUTES } from '@shared/constants';
import type { Task } from '@shared/schema';

/**
 * Tasks dropped on the Bin. Nothing here is gone yet — the row still exists
 * until "Delete forever", which is the only destructive action in the app and
 * asks first.
 */
export default function Bin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: deletedTasks, isLoading, error } = useDeletedTasks();
  const restoreTask = useRestoreTask();
  const deleteTask = useDeleteTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [pendingPurge, setPendingPurge] = useState<Task | null>(null);

  const handleRestore = (task: Task) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    restoreTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: 'Task restored', description: 'The task is back on the board.' });
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      },
    });
  };

  const confirmPurge = () => {
    const task = pendingPurge;
    setPendingPurge(null);
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: 'Deleted forever', description: `“${task.title}” is gone.` });
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading the bin...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 w-full">
          <div className="text-destructive font-bold text-lg">Error loading the bin</div>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate(ROUTES.DASHBOARD);
            }}
            className="rounded-lg h-10 w-10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 neo-raised rounded-lg flex items-center justify-center">
              <Trash2 className="text-destructive h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                Bin
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {deletedTasks?.length ?? 0} deleted{' '}
                {(deletedTasks?.length ?? 0) === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scroll-container">
        <div className="px-3 py-4">
          {deletedTasks && deletedTasks.length > 0 ? (
            <div className="space-y-2">
              {deletedTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-xl"
                  onClick={() => {
                    setSelectedTask(task);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold leading-tight pr-4 flex-1">
                        {task.title}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal neo-pressed rounded-lg px-1.5 py-0 shrink-0 touch-target-sm min-h-0 min-w-0 h-5"
                      >
                        #{task.id}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-1">
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {richTextToPlainText(task.description)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Binned {task.deletedAt ? new Date(task.deletedAt).toLocaleDateString() : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(task);
                          }}
                          className="text-xs rounded-xl h-9 active:scale-95 transition-transform"
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingPurge(task);
                          }}
                          className="text-xs rounded-xl h-9 text-destructive active:scale-95 transition-transform"
                        >
                          Delete forever
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 neo-container rounded-2xl mx-2 mt-4">
              <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-foreground">The bin is empty</h3>
              <p className="text-muted-foreground text-sm">
                Drag a task onto Bin in the bottom bar and it will wait here until you restore or
                delete it.
              </p>
            </div>
          )}
        </div>
      </main>

      <AlertDialog
        open={pendingPurge !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPurge(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task forever?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingPurge?.title}” will be removed permanently. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPurge}>Delete forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditTaskDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}
