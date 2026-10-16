// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { TaskDependenciesField } from './TaskDependenciesField';
import type { InsertTask, Task } from '@shared/schema';

const task = (id: number, title: string) =>
  ({ id, title, archived: false, deletedAt: null, projectId: null }) as unknown as Task;

vi.mock('@/hooks/use-tasks', () => ({
  useTasks: () => ({ data: [task(1, 'Goal'), task(2, 'Block A'), task(3, 'Block B')] }),
  useTaskDependencies: () => ({ data: [{ predecessorId: 2, successorId: 1 }] }),
}));

function Harness({ type }: { type: InsertTask['type'] }) {
  const form = useForm<InsertTask>({
    defaultValues: { title: 'Goal', stageId: 1, type, projectId: null },
  });
  return (
    <FormProvider {...form}>
      <form>
        <TaskDependenciesField control={form.control} taskId={1} />
      </form>
    </FormProvider>
  );
}

afterEach(cleanup);

describe('TaskDependenciesField', () => {
  it('greys out both pickers for a goal, keeping what is linked visible', () => {
    render(<Harness type="goal" />);
    expect(screen.getByTestId<HTMLButtonElement>('task-predecessors').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('task-successors').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('dependencies-goal-note')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remove Block A' }).disabled).toBe(
      true,
    );
  });

  it.each(['building-block', null] as const)('leaves them usable for type %s', (type) => {
    render(<Harness type={type} />);
    expect(screen.getByTestId<HTMLButtonElement>('task-predecessors').disabled).toBe(false);
    expect(screen.getByTestId<HTMLButtonElement>('task-successors').disabled).toBe(false);
    expect(screen.queryByTestId('dependencies-goal-note')).toBeNull();
  });
});
