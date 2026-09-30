import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArchiveIcon, FolderInput, Loader2 } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { useArchiveTask } from '@/hooks/use-tasks';
import { useStages } from '@/hooks/use-stages';
import { useProjectScope } from '@/hooks/use-project-scope';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProjectChip } from '@/components/ProjectChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { richTextToPlainText } from '@/lib/rich-text';
import { isDoneStageName, ROUTES } from '@shared/constants';
import { PROJECT_SCOPE_NONE } from '@shared/project-scope';
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
  // Filing is a view of the board, so it follows the board's project scope.
  const { scope, currentProject, showProjectOnCards, projectById } = useProjectScope();
  const { data: tasks, isLoading, error } = useTasks(scope);
  const { data: stages = [] } = useStages();
  const scopeLabel = currentProject
    ? currentProject.name
    : scope === PROJECT_SCOPE_NONE
      ? 'No project'
      : null;
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
      <PageHeader
        title="Filing"
        subtitle={
          <>
            {totalDone} finished {totalDone === 1 ? 'task' : 'tasks'}
            {scopeLabel && ` · ${scopeLabel}`}
          </>
        }
        icon={<FolderInput className="h-5 w-5 text-primary" />}
        onBack={() => {
          navigate(ROUTES.DASHBOARD);
        }}
        actions={
          // Icon-only on a phone so the bar stays balanced around the title.
          <Button
            variant="ghost"
            size="sm"
            className="h-10 rounded-lg px-2.5 lg:px-3"
            aria-label="Archive"
            onClick={() => {
              navigate(ROUTES.ARCHIVE);
            }}
          >
            <ArchiveIcon className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Archive</span>
          </Button>
        }
      />

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
                    {stageTasks.map((task) => {
                      const project = showProjectOnCards ? projectById(task.projectId) : null;
                      return (
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
                            <div className="flex items-center justify-between gap-2">
                              <span>{project && <ProjectChip project={project} />}</span>
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
                      );
                    })}
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
