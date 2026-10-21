import { useMemo } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import type { Stage, Task } from '@shared/schema';
import { DEFAULT_PROJECT_COLOR, TASK_TYPE } from '@shared/constants';
import { isClosedTaskByStage } from '@shared/stage-state';
import { useArchiveTask, useArchivedTasks, useTasks, useUnarchiveTask } from '@/hooks/use-tasks';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type GoalState = 'open' | 'done' | 'archived';

const STATE_ORDER: Record<GoalState, number> = { open: 0, done: 1, archived: 2 };

function goalState(goal: Task, stages: Stage[]): GoalState {
  if (goal.archived) return 'archived';
  return isClosedTaskByStage(goal, stages) ? 'done' : 'open';
}

/**
 * Admin card for goals: every goal on the board and in the archive, with a
 * way to close one. A goal is a task, so closing it is archiving it; it leaves
 * the board and the filter page, and its building-blocks stay where they are.
 * A goal moved to a done or abandoned stage has already left the filter page,
 * and says so here. Unarchive brings a goal back to the stage it was in.
 */
export function GoalSection({ stages }: { stages: Stage[] }) {
  const { toast } = useToast();
  const { data: live = [], isLoading } = useTasks('all');
  const { data: archived = [] } = useArchivedTasks('all');
  const { projectById, projects } = useProjectScope();
  const archiveTask = useArchiveTask();
  const unarchiveTask = useUnarchiveTask();

  const goals = useMemo(
    () =>
      [...live, ...archived]
        .filter((t) => t.type === TASK_TYPE.GOAL)
        .map((goal) => ({
          goal,
          state: goalState(goal, stages),
          blocks: live.filter((t) => t.goalTaskId === goal.id).length,
        }))
        .sort(
          (a, b) =>
            STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.goal.title.localeCompare(b.goal.title),
        ),
    [live, archived, stages],
  );

  const toggleArchived = (goal: Task) => {
    const mutation = goal.archived ? unarchiveTask : archiveTask;
    mutation.mutate(goal.id, {
      onSuccess: () => {
        toast({ description: goal.archived ? 'Goal reopened' : 'Goal archived' });
      },
      onError: (error) => {
        toast({
          title: 'Failed to update goal',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        });
      },
    });
  };

  const busy = archiveTask.isPending || unarchiveTask.isPending;

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Goals</h2>
        <p className="text-[10px] text-muted-foreground">
          Done, abandoned and archived goals leave the filter page. Archive one to close it; its
          building-blocks stay on the board.
        </p>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No goals yet. Set a task&rsquo;s Type to Goal and it appears here.
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(({ goal, state, blocks }) => {
            const project = goal.projectId == null ? null : projectById(goal.projectId);
            return (
              <div
                key={goal.id}
                className="neo-card flex items-center justify-between gap-3 rounded-md p-3"
                data-testid={`goal-row-${goal.id}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {projects.length > 0 && (
                    <div
                      className={
                        project
                          ? 'h-6 w-6 shrink-0 rounded-lg'
                          : 'h-6 w-6 shrink-0 rounded-lg border border-dashed border-muted-foreground'
                      }
                      style={
                        project
                          ? { backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }
                          : undefined
                      }
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{goal.title}</span>
                      {state !== 'open' && (
                        <Badge
                          variant="outline"
                          className="h-5 min-h-0 min-w-0 px-1.5 py-0 text-[10px] font-normal"
                          data-testid={`goal-state-${goal.id}`}
                        >
                          {state === 'archived'
                            ? 'Archived'
                            : (stages.find((s) => s.id === goal.stageId)?.name.trim() ?? 'Done')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {projects.length > 0 && `${project?.name ?? 'No project'} · `}
                      {blocks} {blocks === 1 ? 'building-block' : 'building-blocks'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-md"
                  onClick={() => {
                    toggleArchived(goal);
                  }}
                  disabled={busy}
                  aria-label={goal.archived ? `Reopen ${goal.title}` : `Archive ${goal.title}`}
                  data-testid={`button-archive-goal-${goal.id}`}
                >
                  {goal.archived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
