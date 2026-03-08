/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-empty-function, @typescript-eslint/no-misused-promises -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskHistoryModal } from '@/components/TaskHistoryModal';
import { StageHeaders } from '@/components/StageHeaders';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { type Task } from '@shared/schema';
import { ROUTES } from '@shared/constants';
import { Loader2 } from 'lucide-react';
import { useStages } from '@/hooks/use-stages';
import { DashboardHeader } from './DashboardHeader';
import { DashboardContent } from './DashboardContent';
import { DashboardBottomNav } from './DashboardBottomNav';
import { useFilteredTasks } from './use-filtered-tasks';
import { useTaskImportExport } from './use-task-import-export';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- page component; props will grow during Phase 5 decomposition
export interface DashboardProps {}

export default function Dashboard(_props: DashboardProps) {
  const { data: tasks, isLoading, error } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('summary');
  const [focusMode, setFocusMode] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: stages = [] } = useStages();

  const filteredTasks = useFilteredTasks({ tasks, searchQuery, focusMode, stages });
  const { handleExport, handleImport } = useTaskImportExport({ tasks, stages });

  useKeyboardShortcuts({
    onNewTask: () => {
      setCreateDialogOpen(true);
    },
    onSave: () => {},
    onCancel: () => {
      setIsEditDialogOpen(false);
      setIsHistoryModalOpen(false);
    },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading your board...</p>
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
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="text-primary font-medium text-sm py-3 px-6 neo-raised rounded-xl active:scale-95 transition-transform"
          >
            Try Refreshing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-bottom-nav">
      <DashboardHeader
        searchQuery={searchQuery}
        showSearch={showSearch}
        onSearchChange={setSearchQuery}
        onToggleSearch={() => {
          setShowSearch(!showSearch);
        }}
        onClearSearch={() => {
          setShowSearch(false);
          setSearchQuery('');
        }}
      />

      {tasks && tasks.length > 0 && (
        <div className="px-3 pt-2">
          <StageHeaders tasks={tasks} />
        </div>
      )}

      <DashboardContent
        tasks={tasks}
        filteredTasks={filteredTasks}
        focusMode={focusMode}
        viewMode={viewMode}
        searchQuery={searchQuery}
        onTaskClick={handleTaskClick}
      />

      <DashboardBottomNav
        viewMode={viewMode}
        focusMode={focusMode}
        onSetViewMode={setViewMode}
        onToggleFocusMode={() => {
          setFocusMode(!focusMode);
        }}
        onArchive={() => (window.location.href = ROUTES.ARCHIVE)}
        onAdmin={() => (window.location.href = ROUTES.ADMIN)}
        onExport={handleExport}
        onImport={handleImport}
      />

      <EditTaskDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onViewHistory={() => {
          setIsEditDialogOpen(false);
          setIsHistoryModalOpen(true);
        }}
      />

      <TaskHistoryModal
        task={selectedTask}
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </div>
  );
}
