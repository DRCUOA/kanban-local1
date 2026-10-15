import { useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { format, startOfToday } from 'date-fns';
import { BarChart3, Route, Target } from 'lucide-react';
import { ROUTES, projectViewPath } from '@shared/constants';
import { blocksOfGoal, goalProgress, planGoal } from '@shared/goal-view';
import type { Task } from '@shared/schema';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useStages } from '@/hooks/use-stages';
import { useTasks, useTaskDependencies } from '@/hooks/use-tasks';
import { CriticalPathView } from './CriticalPathView';
import { GanttChart } from './GanttChart';
import { PageLoading, PageMessage } from './PageState';

type Panel = 'tasks' | 'critical' | 'gantt';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One goal and everything that feeds it: its building-blocks in the order they
 * can be done, with the critical path or a Gantt chart a button press away.
 * The path and chart are worked out only when asked for.
 */
export default function GoalView() {
  const [, navigate] = useLocation();
  const [, params] = useRoute(ROUTES.GOAL_VIEW);
  const goalId = Number(params?.goalId);
  const { projectById } = useProjectScope();
  const { data: tasks = [], isLoading, error } = useTasks();
  const { data: stages = [] } = useStages();
  const { data: edges = [] } = useTaskDependencies();
  const [panel, setPanel] = useState<Panel>('tasks');
  const [editing, setEditing] = useState<Task | null>(null);
  const anchor = useMemo(() => startOfToday(), []);

  const goal = tasks.find((t) => t.id === goalId && t.type === 'goal');
  const blocks = useMemo(() => blocksOfGoal(tasks, goalId), [tasks, goalId]);
  const plan = useMemo(() => planGoal(blocks, edges, stages), [blocks, edges, stages]);

  const back = () => {
    if (goal) navigate(projectViewPath(goal.projectId ?? 'none'));
    else navigate(ROUTES.DASHBOARD);
  };

  if (isLoading) return <PageLoading label="Loading goal..." />;
  if (error) {
    return (
      <PageMessage
        title="Error loading goal"
        detail={error.message}
        actionLabel="Back to the board"
        onAction={() => {
          navigate(ROUTES.DASHBOARD);
        }}
      />
    );
  }
  if (!goal) {
    return (
      <PageMessage
        title="Goal not found"
        detail="It may have been deleted, archived, or is not a goal."
        actionLabel="Back to the board"
        onAction={() => {
          navigate(ROUTES.DASHBOARD);
        }}
      />
    );
  }

  const project = projectById(goal.projectId);
  const progress = goalProgress(blocks, stages);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const stageName = (t: Task) => stages.find((s) => s.id === t.stageId)?.name.trim() ?? '';

  const tab = (id: Panel, label: string, icon: React.ReactNode) => (
    <Button
      type="button"
      variant={panel === id ? 'default' : 'outline'}
      aria-pressed={panel === id}
      onClick={() => {
        setPanel(id);
      }}
      className="h-10 gap-2"
      data-testid={`panel-${id}`}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader
        title={goal.title}
        subtitle={`${project ? `${project.name} · ` : ''}${progress.done} of ${plural(progress.total, 'task')} done`}
        icon={<Target className="h-5 w-5 text-primary" />}
        onBack={back}
        actions={
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Goal view">
          {tab('tasks', 'Tasks in order', null)}
          {tab('critical', 'Critical path', <Route className="h-4 w-4" aria-hidden />)}
          {tab('gantt', 'Gantt chart', <BarChart3 className="h-4 w-4" aria-hidden />)}
          <Button
            type="button"
            variant="ghost"
            className="ml-auto h-10"
            onClick={() => {
              setEditing(goal);
            }}
          >
            Edit goal
          </Button>
        </div>

        {blocks.length === 0 ? (
          <div className="space-y-2 py-16 text-center" data-testid="no-blocks">
            <p className="font-semibold">No building-blocks yet</p>
            <p className="text-sm text-muted-foreground">
              Create a task, set its type to Building block and choose this goal.
            </p>
          </div>
        ) : plan.cyclic ? (
          <p className="text-sm text-danger">
            These tasks depend on each other in a loop, so no order exists. Remove one dependency.
          </p>
        ) : (
          <>
            {panel === 'tasks' && (
              <ol className="space-y-2" data-testid="ordered-tasks">
                {plan.order.map((item, i) => {
                  const t = byId.get(item.id);
                  if (!t) return null;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(t);
                        }}
                        className="neo-raised flex w-full items-start gap-3 rounded-md p-3 text-left"
                      >
                        <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{t.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            #{t.id} · {stageName(t)}
                            {t.dueDate ? ` · due ${format(new Date(t.dueDate), 'd MMM yyyy')}` : ''}
                            {item.duration > 0 ? ` · ${plural(item.duration, 'day')}` : ''}
                          </span>
                          {item.predecessors.length > 0 && (
                            <span className="mt-1 block text-xs">
                              Waits for:{' '}
                              {item.predecessors
                                .map((p) => `#${p} ${byId.get(p)?.title ?? ''}`.trim())
                                .join(', ')}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {panel === 'critical' && (
              <CriticalPathView
                schedule={plan}
                tasks={blocks}
                anchor={anchor}
                onTaskClick={setEditing}
              />
            )}
            {panel === 'gantt' && (
              <GanttChart schedule={plan} tasks={blocks} anchor={anchor} onTaskClick={setEditing} />
            )}
            {panel !== 'tasks' && (
              <p className="mt-4 text-xs text-muted-foreground">
                Effort counts as days (a task with no effort counts as 1 day, finished tasks as 0),
                and the plan starts today. Only dependencies between this goal's tasks are used.
              </p>
            )}
          </>
        )}
      </main>

      <EditTaskDialog
        task={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onViewHistory={() => {
          setEditing(null);
        }}
      />
    </div>
  );
}
