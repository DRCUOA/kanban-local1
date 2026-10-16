import { useRoute, useLocation } from 'wouter';
import { format } from 'date-fns';
import { Target } from 'lucide-react';
import { ROUTES, goalViewPath } from '@shared/constants';
import { PROJECT_SCOPE_NONE } from '@shared/project-scope';
import {
  blocksOfGoal,
  goalProgress,
  goalsInProject,
  planGoal,
  unassignedBlocks,
} from '@shared/goal-view';
import { stageKind } from '@shared/stage-state';
import { STAGE_KIND_LABEL } from '@shared/constants';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useStages } from '@/hooks/use-stages';
import { useTasks, useTaskDependencies } from '@/hooks/use-tasks';
import { PageLoading, PageMessage } from './PageState';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Every goal in one project, each with how far along it is and how many days
 * of dependent work are left. Choosing a goal opens its own view.
 */
export default function ProjectView() {
  const [, navigate] = useLocation();
  const [, params] = useRoute(ROUTES.PROJECT_VIEW);
  const { projectById } = useProjectScope();

  const raw = params?.projectId;
  const parsed = raw === 'none' ? null : Number(raw);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed > 0);
  const projectId = valid ? parsed : null;
  const project = projectId === null ? null : projectById(projectId);
  const scope = projectId ?? PROJECT_SCOPE_NONE;

  const { data: tasks = [], isLoading, error } = useTasks(scope);
  const { data: stages = [] } = useStages();
  const { data: edges = [] } = useTaskDependencies();
  const back = () => {
    navigate(ROUTES.DASHBOARD);
  };

  if (!valid) {
    return (
      <PageMessage title="Project not found" actionLabel="Back to the board" onAction={back} />
    );
  }
  if (isLoading) return <PageLoading label="Loading goals..." />;
  if (error) {
    return (
      <PageMessage
        title="Error loading goals"
        detail={error.message}
        actionLabel="Back to the board"
        onAction={back}
      />
    );
  }

  const name = project?.name ?? 'No project';
  const goals = goalsInProject(tasks, projectId);
  const loose = unassignedBlocks(tasks, projectId);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader
        title={name}
        subtitle={`Goals · ${plural(goals.length, 'goal')}`}
        icon={<Target className="h-5 w-5 text-primary" />}
        onBack={back}
        actions={
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto px-3 py-4">
        {goals.length === 0 ? (
          <div className="mx-auto max-w-md space-y-2 py-16 text-center" data-testid="no-goals">
            <p className="font-semibold">No goals in this project yet</p>
            <p className="text-sm text-muted-foreground">
              Create a task, set its type to Goal and put it in this project. Building-blocks then
              pick it as their goal.
            </p>
          </div>
        ) : (
          <ul className="mx-auto grid max-w-5xl gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const blocks = blocksOfGoal(tasks, goal.id);
              const progress = goalProgress(blocks, stages);
              const plan = planGoal(blocks, edges, stages);
              const stage = stages.find((s) => s.id === goal.stageId);
              const pct =
                progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(goalViewPath(goal.id));
                    }}
                    className="neo-raised h-full w-full rounded-md p-4 text-left transition-transform active:scale-[0.98]"
                    data-testid={`goal-card-${goal.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold leading-tight">{goal.title}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        #{goal.id}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {stage ? `${stage.name.trim()} (${STAGE_KIND_LABEL[stageKind(stage)]})` : ''}
                      {goal.dueDate ? ` · due ${format(new Date(goal.dueDate), 'd MMM yyyy')}` : ''}
                    </div>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label={`${progress.done} of ${progress.total} building-blocks done`}
                    >
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs">
                      <span>
                        {progress.total === 0
                          ? 'No building-blocks yet'
                          : `${progress.done} of ${plural(progress.total, 'task')} done`}
                      </span>
                      {plan.length > 0 && (
                        <span className="text-muted-foreground">
                          {plural(plan.length, 'day')} left
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {loose.length > 0 && (
          <p
            className="mx-auto mt-6 max-w-5xl text-xs text-muted-foreground"
            data-testid="loose-blocks"
          >
            {plural(loose.length, 'building-block')} in this project{' '}
            {loose.length === 1 ? 'has' : 'have'} no goal yet.
          </p>
        )}
      </main>
    </div>
  );
}
