import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, ArchiveIcon, FolderInput, Loader2 } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { useArchiveTask } from '@/hooks/use-tasks';
import { useStages } from '@/hooks/use-stages';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { richTextToPlainText } from '@/lib/rich-text';
import { isDoneStageName, ROUTES } from '@shared/constants';
import { sortTasksByDueDate } from '@shared/task-sort';
import type { Task } from '@shared/schema';

/**
 * Where finished work lives now that the done strip is off the board: the tasks
 * sitting in each done stage, grouped by stage, with a one-tap route on to the
 * archive.
 */
export default function Filing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: tasks, isLoading, error } = useTasks();
  const { data: stages = [] } = useStages();
  const archiveTask = useArchiveTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const doneStages = [...stages]
    .sort((a, b) => a.order - b.order)
    .filter((s) => isDoneStageName(s.name));

  const handleArchive = (task: Task) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    archiveTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: 'Task archived', description: 'Find it under Filing → Archive.' });
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
          <p className="text-muted-foreground font-medium text-sm">Loading filing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 w-full">
          <div className="text-destructive font-bold text-lg">Error loading tasks</div>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const totalDone = doneStages.reduce(
    (sum, stage) => sum + (tasks?.filter((t) => t.stageId === stage.id).length ?? 0),
    0,
  );

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
              <FolderInput className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                Filing
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {totalDone} finished {totalDone === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg h-10"
            onClick={() => {
              navigate(ROUTES.ARCHIVE);
            }}
          >
            <ArchiveIcon className="mr-2 h-4 w-4" />
            Archive
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scroll-container">
        <div className="px-3 py-4 space-y-6">
          {doneStages.map((stage) => {
            const stageTasks = sortTasksByDueDate(
              (tasks ?? []).filter((t) => t.stageId === stage.id),
            );
            return (
              <section key={stage.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stage.color ?? undefined }}
                    aria-hidden
                  />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-fg-secondary">
                    {stage.name.trim()}
                  </h2>
                  <span className="text-xs text-muted-foreground">{stageTasks.length}</span>
                </div>

                {stageTasks.length > 0 ? (
                  <div className="space-y-2">
                    {stageTasks.map((task) => (
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
                          <div className="flex items-center justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(task);
                              }}
                              className="text-xs rounded-xl h-9 active:scale-95 transition-transform"
                            >
                              Archive
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 text-xs text-muted-foreground">Nothing filed here yet.</p>
                )}
              </section>
            );
          })}

          {doneStages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-8 neo-container rounded-2xl mx-2 mt-4">
              <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
                <FolderInput className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-foreground">No done stage</h3>
              <p className="text-muted-foreground text-sm">
                Add a stage named &ldquo;Done&rdquo; in Admin and finished tasks will collect here.
              </p>
            </div>
          )}
        </div>
      </main>

      <EditTaskDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}
