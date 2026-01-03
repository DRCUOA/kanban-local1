import { useState } from "react";
import { useArchivedTasks, useUnarchiveTask } from "@/hooks/use-tasks";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { Task } from "@shared/schema";
import { Loader2, Archive as ArchiveIcon, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Archive() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: archivedTasks, isLoading, error } = useArchivedTasks();
  const unarchiveTask = useUnarchiveTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  const handleUnarchive = (task: Task) => {
    unarchiveTask.mutate(task.id, {
      onSuccess: () => {
        toast({
          title: "Task unarchived",
          description: "The task has been restored to the board.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const filteredTasks = archivedTasks?.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading archived tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="text-destructive font-bold text-xl">Error loading archived tasks</div>
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
          {/* Top Row - Logo */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 neo-raised rounded-xl flex items-center justify-center">
                <ArchiveIcon className="text-primary h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Archive</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Archived Tasks</p>
              </div>
            </div>
          </div>
          
          {/* Bottom Row - Navigation & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center justify-center gap-4 w-full md:w-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/")}
                    className="rounded-xl h-11 w-11"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Back to Board</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input 
                placeholder="Search archived tasks..." 
                className="pl-11 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          {filteredTasks && filteredTasks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="group relative cursor-pointer transition-all duration-300"
                  onClick={() => handleTaskClick(task)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold leading-tight pr-6">
                        {task.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs font-normal neo-pressed rounded-lg px-2 py-1">
                        #{task.id}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
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
                        className="text-xs rounded-xl"
                      >
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 neo-container rounded-3xl m-4">
              <div className="h-20 w-20 neo-pressed rounded-full flex items-center justify-center mb-6">
                <ArchiveIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">No archived tasks</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                {searchQuery 
                  ? "No archived tasks match your search query."
                  : "Tasks you archive will appear here."}
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
