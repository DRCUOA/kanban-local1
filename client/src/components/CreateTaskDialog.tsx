import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask } from "@shared/schema";
import { useCreateTask } from "@/hooks/use-tasks";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateTaskDialogProps {
  iconOnly?: boolean;
}

export function CreateTaskDialog({ iconOnly = false }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createTask = useCreateTask();

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

  const defaultStageId = stages[0]?.id || 1;
  
  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      stageId: defaultStageId,
      status: "backlog",
      priority: "normal",
      recurrence: "none",
    },
  });

  const onSubmit = (data: InsertTask) => {
    const selectedStage = stages.find((s: any) => s.id === data.stageId);
    let status = data.status;
    if (!status && selectedStage) {
      const stageName = selectedStage.name.toLowerCase();
      if (stageName.includes("progress") || stageName.includes("doing") || stageName.includes("active")) status = "in_progress";
      else if (stageName.includes("done") || stageName.includes("complete") || stageName.includes("finished")) status = "done";
      else status = "backlog";
    }
    
    createTask.mutate({ ...data, status: status || "backlog" }, {
      onSuccess: () => {
        if ('vibrate' in navigator) navigator.vibrate(10);
        toast({ title: "Task created", description: "Your new task has been added." });
        setOpen(false);
        form.reset({ stageId: defaultStageId, title: "", description: "", status: "backlog", priority: "normal", recurrence: "none" });
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            className="flex flex-col items-center gap-1 -mt-4 relative"
            data-testid="button-add-task"
          >
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform">
              <Plus className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium">Add</span>
          </button>
        ) : (
          <Button 
            className="gap-2 rounded-xl active:scale-95 transition-transform w-full" 
            data-testid="button-add-task"
          >
            <Plus className="h-5 w-5" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg">Create New Task</DialogTitle>
            <DialogDescription className="text-xs">
              Add a new task to your board.
            </DialogDescription>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4 overflow-y-auto">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Design homepage" 
                      {...field} 
                      className="h-12 text-base rounded-xl"
                      data-testid="input-task-title" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Stage</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()} className="py-3">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add details..."
                      className="resize-none rounded-xl text-base"
                      rows={4}
                      {...field}
                      value={field.value || ""}
                      data-testid="input-task-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "normal"}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low" className="py-3">Low</SelectItem>
                        <SelectItem value="normal" className="py-3">Normal</SelectItem>
                        <SelectItem value="high" className="py-3">High</SelectItem>
                        <SelectItem value="critical" className="py-3">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="effort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Effort (1-5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        className="h-12 rounded-xl text-base"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Spacer to push button to bottom */}
            <div className="flex-1" />
            
            <div className="flex gap-3 pt-4 pb-safe-bottom sticky bottom-0 bg-background">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-12 rounded-xl"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTask.isPending} 
                className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
                data-testid="button-submit-task"
              >
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
