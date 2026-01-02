import { useState, useMemo } from "react";
import { useTasks, useCreateTask } from "@/hooks/use-tasks";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { TaskHistoryModal } from "@/components/TaskHistoryModal";
import { FocusModeToggle } from "@/components/FocusModeToggle";
import { TaskWarnings } from "@/components/TaskWarnings";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Task, type InsertTask } from "@shared/schema";
import { Loader2, LayoutDashboard, Search, Archive, Settings, Plus, List, CircleDot, Download, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: tasks, isLoading, error } = useTasks();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"detail" | "summary">("summary");
  const [focusMode, setFocusMode] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: stages = [] } = useQuery({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.stages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => setCreateDialogOpen(true),
    onSave: () => {
      // Save is handled by inline editor
    },
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
    let filtered = tasks?.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    ) || [];

    if (focusMode) {
      // Focus mode: show only In Progress + one suggested Next task
      // Check status field, or infer from stage name if status not set
      const getTaskStatus = (t: Task): string => {
        if (t.status) return t.status;
        // Infer from stage name if status not set
        const stage = stages.find((s: any) => s.id === t.stageId);
        if (stage) {
          const name = stage.name.toLowerCase();
          if (name.includes("progress") || name.includes("doing") || name.includes("active")) {
            return "in_progress";
          }
          if (name.includes("done") || name.includes("complete") || name.includes("finished")) {
            return "done";
          }
        }
        return "backlog";
      };
      
      const inProgress = filtered.filter(t => getTaskStatus(t) === "in_progress");
      const backlog = filtered.filter(t => getTaskStatus(t) === "backlog");
      // Get highest priority task from backlog as "Next"
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
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          
          if (!Array.isArray(imported)) {
            toast({
              title: "Invalid format",
              description: "Import file must contain an array of tasks.",
              variant: "destructive",
            });
            return;
          }

          // Store backup in localStorage
          localStorage.setItem("taskflow-backup", JSON.stringify(imported));
          
          // Use existing stages from query, or fetch if not available
          let stagesData = stages;
          
          // Always fetch fresh stages to ensure we have the latest data
          try {
            const stagesResponse = await fetch(api.stages.list.path);
            if (!stagesResponse.ok) {
              throw new Error(`Failed to fetch stages: ${stagesResponse.status}`);
            }
            const fetchedStages = await stagesResponse.json();
            if (Array.isArray(fetchedStages) && fetchedStages.length > 0) {
              stagesData = fetchedStages;
            }
          } catch (error: any) {
            console.error("Error fetching stages:", error);
            // Fall back to cached stages if fetch fails
            if (!stagesData || stagesData.length === 0) {
              toast({
                title: "Error fetching stages",
                description: error.message || "Could not load stages. Please refresh and try again.",
                variant: "destructive",
              });
              return;
            }
          }
          
          if (!Array.isArray(stagesData) || stagesData.length === 0) {
            console.error("No stages available:", { stages, stagesData });
            toast({
              title: "No stages found",
              description: "Please create stages before importing tasks.",
              variant: "destructive",
            });
            return;
          }
          
          console.log("Stages available for import:", stagesData.length, stagesData);

          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          // Import tasks one by one
          for (const taskData of imported) {
            try {
              // Validate and prepare task data
              const taskToCreate = {
                title: taskData.title || "Untitled Task",
                description: taskData.description || "",
                stageId: taskData.stageId || stagesData[0].id,
                status: taskData.status || "backlog",
                priority: taskData.priority || "normal",
                effort: taskData.effort || undefined,
                dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
                tags: Array.isArray(taskData.tags) ? taskData.tags : [],
                recurrence: taskData.recurrence || "none",
              } as InsertTask;

              // Validate stageId exists
              if (!stagesData.find((s: any) => s.id === taskToCreate.stageId)) {
                taskToCreate.stageId = stagesData[0].id; // Default to first stage
              }

              await createTask.mutateAsync(taskToCreate);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(`Task "${taskData.title || 'Untitled'}": ${error.message || 'Unknown error'}`);
            }
          }

          // Show results
          if (successCount > 0) {
            toast({
              title: "Import completed",
              description: `Successfully imported ${successCount} task${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
            });
          }

          if (errorCount > 0 && successCount === 0) {
            toast({
              title: "Import failed",
              description: `Failed to import ${errorCount} task${errorCount > 1 ? 's' : ''}. Check console for details.`,
              variant: "destructive",
            });
            console.error("Import errors:", errors);
          }
        } catch (error: any) {
          toast({
            title: "Import error",
            description: error.message || "Failed to parse import file. Please check the format.",
            variant: "destructive",
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
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading your board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="text-destructive font-bold text-xl">Error loading tasks</div>
          <p className="text-muted-foreground">{(error as Error).message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-primary hover:underline font-medium"
          >
            Try Refreshing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 neo-container rounded-none border-0 border-b-0">
        <div className="container mx-auto px-6 py-4">
          {/* Top Row - Logo and Title */}
          <div className="flex flex-col items-center justify-center mb-4 md:flex-row md:mb-4">
            {/* Logo - First line on mobile, left side on desktop */}
            <div className="h-14 w-14 neo-raised rounded-xl flex items-center justify-center mb-2 md:mb-0 md:mr-4">
              <LayoutDashboard className="text-primary h-7 w-7" />
            </div>
            {/* Title and Subtitle - Second and third lines on mobile, right side on desktop */}
            <div className="flex flex-col items-center justify-center text-center">
              {/* Subtitle - Second line on mobile */}
              <p className="text-xs text-muted-foreground mb-1 md:hidden">
                {import.meta.env.VITE_APP_NAME_SUBTITLE || "SubNameNotSetInEnv"}
              </p>
              {/* Title - Third line on mobile, first line on desktop */}
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {import.meta.env.VITE_APP_NAME || "NameNotSetInEnv"}
              </h1>
              {/* Subtitle - Hidden on mobile (shown above), visible on desktop */}
              <p className="text-xs text-muted-foreground hidden md:block">
                {import.meta.env.VITE_APP_NAME_SUBTITLE || "SubNameNotSetInEnv"}
              </p>
            </div>
          </div>
          
          {/* Bottom Row - Navigation & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center justify-center gap-4 w-full md:w-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <CreateTaskDialog iconOnly />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create Task</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "detail" ? "default" : "outline"}
                    size="icon"
                    className="rounded-xl h-11 w-11"
                    onClick={() => setViewMode("detail")}
                  >
                    <List className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Detail View</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "summary" ? "default" : "outline"}
                    size="icon"
                    className="rounded-xl h-11 w-11"
                    onClick={() => setViewMode("summary")}
                  >
                    <CircleDot className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Summary View</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="/archive">
                    <Button variant="outline" size="icon" className="rounded-xl h-11 w-11">
                      <Archive className="h-5 w-5" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Archive</p>
                </TooltipContent>
              </Tooltip>
              
              <FocusModeToggle enabled={focusMode} onToggle={setFocusMode} />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="/admin">
                    <Button variant="outline" size="icon" className="rounded-xl h-11 w-11" data-testid="button-admin">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Admin</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-xl h-11 w-11" onClick={handleExport}>
                    <Download className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export Tasks</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-xl h-11 w-11" onClick={handleImport}>
                    <Upload className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Import Tasks</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input 
                placeholder="Search tasks..." 
                className="pl-11 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Board Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="container mx-auto flex-1 flex flex-col min-h-0 p-2 sm:p-4 lg:p-6">
          {focusMode && (
            <div className="mb-4 p-4 neo-container rounded-2xl border-l-4 border-l-blue-500 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <p className="text-sm font-medium">Focus Mode: Showing only In Progress tasks and next suggested task</p>
              </div>
            </div>
          )}
          
          {tasks && tasks.length > 0 && <div className="flex-shrink-0"><TaskWarnings tasks={tasks} /></div>}
          
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
            <div className="h-full flex flex-col items-center justify-center text-center p-12 neo-container rounded-3xl m-4">
              <div className="h-20 w-20 neo-pressed rounded-full flex items-center justify-center mb-6">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">No tasks found</h3>
              <p className="text-muted-foreground max-w-sm mb-8">
                {searchQuery 
                  ? "No tasks match your search query. Try a different term."
                  : "Your board is empty. Create your first task to get started."}
              </p>
              {!searchQuery && <CreateTaskDialog />}
            </div>
          )}
        </div>
      </main>

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
