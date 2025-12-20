import { useState } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { Task } from "@shared/schema";
import { Loader2, LayoutDashboard, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Dashboard() {
  const { data: tasks, isLoading, error } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  const filteredTasks = tasks?.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutDashboard className="text-white h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TaskFlow</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Project Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tasks..." 
                className="pl-9 h-10 rounded-xl bg-secondary/50 border-transparent focus:bg-background focus:border-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <CreateTaskDialog />
            <a href="/admin">
              <button className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover-elevate" data-testid="button-admin">
                Admin
              </button>
            </a>
          </div>
        </div>
      </header>
      
      {/* Mobile Search - Visible only on small screens */}
      <div className="md:hidden px-4 py-3 border-b border-border/40 bg-secondary/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tasks..." 
            className="pl-9 h-10 rounded-xl bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Board Content */}
      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto h-full p-4 lg:p-6">
          {filteredTasks && filteredTasks.length > 0 ? (
            <KanbanBoard tasks={filteredTasks} onTaskClick={handleTaskClick} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-3xl bg-secondary/10 m-4">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">No tasks found</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
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
      />
    </div>
  );
}
