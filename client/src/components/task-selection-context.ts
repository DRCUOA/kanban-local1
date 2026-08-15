import { createContext, useContext } from 'react';
import type { Task } from '@shared/schema';

/**
 * Board-level multi-select state, consumed by the task cards.
 *
 * A context (rather than props through KanbanColumnContent / DayPlanSubStage)
 * keeps the intermediate layout components untouched. The default value makes
 * cards rendered outside a provider — drag overlays, tests — behave like an
 * empty selection whose right-click only suppresses the native menu.
 */
export interface TaskSelectionContextValue {
  selectedTaskIds: ReadonlySet<number>;
  /** Right-click on a card; the provider decides whether to open the share dialog. */
  onTaskContextMenu: (task: Task, event: React.MouseEvent) => void;
}

export const TaskSelectionContext = createContext<TaskSelectionContextValue>({
  selectedTaskIds: new Set<number>(),
  onTaskContextMenu: (_task, event) => {
    event.preventDefault();
  },
});

export function useTaskSelection(): TaskSelectionContextValue {
  return useContext(TaskSelectionContext);
}
