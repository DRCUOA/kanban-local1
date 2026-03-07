/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState, useMemo } from 'react';
import { useTasks, useCreateTask } from '@/hooks/use-tasks';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskHistoryModal } from '@/components/TaskHistoryModal';
import { TaskWarnings } from '@/components/TaskWarnings';
import { StageHeaders } from '@/components/StageHeaders';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Task, type InsertTask } from '@shared/schema';
import {
  Loader2,
  LayoutDashboard,
  Search,
  Archive,
  Settings,
  Plus,
  List,
  CircleDot,
  Download,
  Upload,
  Focus,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: tasks, isLoading, error } = useTasks();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('summary');
  const [focusMode, setFocusMode] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: stages = [] } = useQuery({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.stages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Failed to fetch stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`,
          );
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(
            'Network error: Unable to connect to server. Please check if the server is running.',
          );
        }
        throw error;
      }
    },
  });

  // Keyboard shortcuts
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

  // Filter tasks based on search and focus mode
  const filteredTasks = useMemo(() => {
    let filtered =
      tasks?.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())),
      ) || [];

    if (focusMode) {
      const getTaskStatus = (t: Task): string => {
        if (t.status) return t.status;
        const stage = stages.find((s: any) => s.id === t.stageId);
        if (stage) {
          const name = stage.name.toLowerCase();
          if (name.includes('progress') || name.includes('doing') || name.includes('active'))
            return 'in_progress';
          if (name.includes('done') || name.includes('complete') || name.includes('finished'))
            return 'done';
        }
        return 'backlog';
      };

      const inProgress = filtered.filter((t) => getTaskStatus(t) === 'in_progress');
      const backlog = filtered.filter((t) => getTaskStatus(t) === 'backlog');
      const nextTask = backlog.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
        return bPriority - aPriority;
      })[0];

      filtered = [...inProgress];
      if (nextTask) filtered.push(nextTask);
    }

    return filtered;
  }, [tasks, searchQuery, focusMode, stages]);

  // Export/Import functions
  const handleExport = () => {
    if (!tasks) return;
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);

          if (!Array.isArray(imported)) {
            toast({
              title: 'Invalid format',
              description: 'Import file must contain an array of tasks.',
              variant: 'destructive',
            });
            return;
          }

          localStorage.setItem('taskflow-backup', JSON.stringify(imported));

          let stagesData = stages;
          try {
            const stagesResponse = await fetch(api.stages.list.path);
            if (!stagesResponse.ok)
              throw new Error(`Failed to fetch stages: ${stagesResponse.status}`);
            const fetchedStages = await stagesResponse.json();
            if (Array.isArray(fetchedStages) && fetchedStages.length > 0)
              stagesData = fetchedStages;
          } catch (error: any) {
            console.error('Error fetching stages:', error);
            if (!stagesData || stagesData.length === 0) {
              toast({
                title: 'Error fetching stages',
                description: error.message || 'Could not load stages.',
                variant: 'destructive',
              });
              return;
            }
          }

          if (!Array.isArray(stagesData) || stagesData.length === 0) {
            toast({
              title: 'No stages found',
              description: 'Please create stages before importing tasks.',
              variant: 'destructive',
            });
            return;
          }

          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const taskData of imported) {
            try {
              const taskToCreate = {
                title: taskData.title || 'Untitled Task',
                description: taskData.description || '',
                stageId: taskData.stageId || stagesData[0].id,
                status: taskData.status || 'backlog',
                priority: taskData.priority || 'normal',
                effort: taskData.effort || undefined,
                dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
                tags: Array.isArray(taskData.tags) ? taskData.tags : [],
                recurrence: taskData.recurrence || 'none',
              } as InsertTask;

              if (!stagesData.find((s: any) => s.id === taskToCreate.stageId)) {
                taskToCreate.stageId = stagesData[0].id;
              }

              await createTask.mutateAsync(taskToCreate);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(
                `Task "${taskData.title || 'Untitled'}": ${error.message || 'Unknown error'}`,
              );
            }
          }

          if (successCount > 0) {
            toast({
              title: 'Import completed',
              description: `Successfully imported ${successCount} task${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
            });
          }
          if (errorCount > 0 && successCount === 0) {
            toast({
              title: 'Import failed',
              description: `Failed to import ${errorCount} task${errorCount > 1 ? 's' : ''}.`,
              variant: 'destructive',
            });
            console.error('Import errors:', errors);
          }
        } catch (error: any) {
          toast({
            title: 'Import error',
            description: error.message || 'Failed to parse import file.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
      {/* Compact Mobile Header */}
      <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
        <div className="flex items-center justify-between">
          {/* App identity - compact */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 neo-raised rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                {import.meta.env.VITE_APP_NAME || 'NameNotSetInEnv'}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {import.meta.env.VITE_APP_NAME_SUBTITLE || 'SubNameNotSetInEnv'}
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg h-10 w-10"
              onClick={() => {
                setShowSearch(!showSearch);
              }}
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Expandable search bar */}
        {showSearch && (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search tasks..."
                className="pl-10 h-11 rounded-xl"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                autoFocus
                data-testid="input-search"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg h-10 w-10 shrink-0"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </header>

      {/* Stage Headers - Scrollable tabs */}
      {tasks && tasks.length > 0 && (
        <div className="px-3 pt-2">
          <StageHeaders tasks={tasks} />
        </div>
      )}

      {/* Board Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 flex flex-col min-h-0 px-3 pt-2">
          {focusMode && (
            <div className="mb-3 p-3 neo-container rounded-xl border-l-4 border-l-blue-500 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <p className="text-xs font-medium">Focus Mode Active</p>
              </div>
            </div>
          )}

          {tasks && tasks.length > 0 && (
            <div className="flex-shrink-0">
              <TaskWarnings tasks={tasks} />
            </div>
          )}

          {filteredTasks && filteredTasks.length > 0 ? (
            <div className="flex-1 min-h-0">
              <KanbanBoard
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                viewMode={viewMode}
                focusMode={focusMode}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 neo-container rounded-2xl mx-2 my-4">
              <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-foreground">No tasks found</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {searchQuery
                  ? 'No tasks match your search.'
                  : 'Create your first task to get started.'}
              </p>
              {!searchQuery && <CreateTaskDialog />}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <div className="flex items-center justify-around px-2 py-2">
          {/* View Mode Toggle */}
          <button
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
              viewMode === 'detail' && 'text-primary',
            )}
            onClick={() => {
              setViewMode('detail');
            }}
          >
            <List className="h-5 w-5" />
            <span className="text-[10px] font-medium">Detail</span>
          </button>

          {/* Summary View */}
          <button
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
              viewMode === 'summary' && 'text-primary',
            )}
            onClick={() => {
              setViewMode('summary');
            }}
          >
            <CircleDot className="h-5 w-5" />
            <span className="text-[10px] font-medium">Summary</span>
          </button>

          {/* Create Task - Prominent center button */}
          <CreateTaskDialog iconOnly />

          {/* Focus Mode */}
          <button
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
              focusMode && 'text-primary',
            )}
            onClick={() => {
              setFocusMode(!focusMode);
            }}
          >
            <Focus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Focus</span>
          </button>

          {/* More Actions Menu */}
          <MoreActionsMenu
            onArchive={() => (window.location.href = '/archive')}
            onAdmin={() => (window.location.href = '/admin')}
            onExport={handleExport}
            onImport={handleImport}
          />
        </div>
      </nav>

      {/* Edit Dialog */}
      <EditTaskDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onViewHistory={() => {
          setIsEditDialogOpen(false);
          setIsHistoryModalOpen(true);
        }}
      />

      {/* History Modal */}
      <TaskHistoryModal
        task={selectedTask}
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </div>
  );
}

// More Actions Menu component for bottom nav
function MoreActionsMenu({
  onArchive,
  onAdmin,
  onExport,
  onImport,
}: {
  onArchive: () => void;
  onAdmin: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-medium">More</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => {
              setOpen(false);
            }}
          />

          {/* Popup Menu */}
          <div className="absolute bottom-full right-0 mb-2 z-50 neo-raised rounded-xl p-2 w-48 animate-slide-up">
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onArchive();
                setOpen(false);
              }}
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onAdmin();
                setOpen(false);
              }}
            >
              <Settings className="h-4 w-4" />
              Admin
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            >
              <Download className="h-4 w-4" />
              Export Tasks
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onImport();
                setOpen(false);
              }}
            >
              <Upload className="h-4 w-4" />
              Import Tasks
            </button>
          </div>
        </>
      )}
    </div>
  );
}
