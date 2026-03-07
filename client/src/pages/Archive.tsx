/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import { useArchivedTasks, useUnarchiveTask } from '@/hooks/use-tasks';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { Task } from '@shared/schema';
import { Loader2, Archive as ArchiveIcon, Search, ArrowLeft, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function Archive() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: archivedTasks, isLoading, error } = useArchivedTasks();
  const unarchiveTask = useUnarchiveTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  const handleUnarchive = (task: Task) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    unarchiveTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: 'Task restored', description: 'The task has been restored to the board.' });
      },
      onError: (error) => {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      },
    });
  };

  const filteredTasks = archivedTasks?.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading archived tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 w-full">
          <div className="text-destructive font-bold text-lg">Error loading archived tasks</div>
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate('/');
            }}
            className="rounded-lg h-10 w-10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 neo-raised rounded-lg flex items-center justify-center">
              <ArchiveIcon className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                Archive
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Archived Tasks</p>
            </div>
          </div>
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

        {/* Expandable search */}
        {showSearch && (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search archived tasks..."
                className="pl-10 h-11 rounded-xl"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                autoFocus
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto scroll-container">
        <div className="px-3 py-4">
          {filteredTasks && filteredTasks.length > 0 ? (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-xl"
                  onClick={() => {
                    handleTaskClick(task);
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
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(task.createdAt || new Date()).toLocaleDateString()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchive(task);
                        }}
                        className="text-xs rounded-xl h-9 active:scale-95 transition-transform"
                      >
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 neo-container rounded-2xl mx-2 mt-4">
              <div className="h-16 w-16 neo-pressed rounded-full flex items-center justify-center mb-4">
                <ArchiveIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-foreground">No archived tasks</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? 'No archived tasks match your search.'
                  : 'Tasks you archive will appear here.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <EditTaskDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}
