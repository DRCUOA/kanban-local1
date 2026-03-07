/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Task } from "@shared/schema";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, History } from "lucide-react";
import { useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import "react-day-picker/dist/style.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewHistory?: () => void;
}

export function EditTaskDialog({ task, open, onOpenChange, onViewHistory }: EditTaskDialogProps) {
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

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

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      stageId: 1,
    },
  });

  useEffect(() => {
    if (task && open) {
      try {
        let parsedDueDate: Date | undefined = undefined;
        if (task.dueDate) {
          if (task.dueDate instanceof Date) parsedDueDate = task.dueDate;
          else {
            const date = new Date(task.dueDate);
            if (!isNaN(date.getTime())) parsedDueDate = date;
          }
        }

        form.reset({
          title: task.title,
          description: task.description || "",
          stageId: task.stageId,
          status: task.status || "backlog",
          priority: task.priority || "normal",
          effort: task.effort || undefined,
          dueDate: parsedDueDate,
          tags: Array.isArray(task.tags) ? task.tags : [],
          recurrence: task.recurrence || "none",
        });
      } catch (error) {
        console.error("Error resetting form:", error);
        form.reset({
          title: task.title || "",
          description: task.description || "",
          stageId: task.stageId || 1,
          status: task.status || "backlog",
          priority: task.priority || "normal",
          effort: task.effort || undefined,
          dueDate: undefined,
          tags: [],
          recurrence: task.recurrence || "none",
        });
      }
    }
  }, [task?.id, open]);

  const onSubmit = (data: InsertTask) => {
    if (!task) return;
    
    updateTask.mutate({ id: task.id, ...data }, {
      onSuccess: () => {
        if ('vibrate' in navigator) navigator.vibrate(10);
        toast({ title: "Task updated", description: "Changes saved." });
        onOpenChange(false);
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  const handleDelete = () => {
    if (!task) return;
    
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
        toast({ title: "Task deleted", description: "The task has been permanently removed." });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg">Edit Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4 overflow-y-auto scroll-container">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-12 text-base rounded-xl" data-testid="input-edit-title" />
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
                  <Select onValueChange={(v) => { field.onChange(Number(v)); }} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue />
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
                      className="resize-none rounded-xl text-base"
                      rows={5}
                      {...field}
                      value={field.value || ""}
                      data-testid="input-edit-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "backlog"}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="backlog" className="py-3">Backlog</SelectItem>
                        <SelectItem value="in_progress" className="py-3">In Progress</SelectItem>
                        <SelectItem value="done" className="py-3">Done</SelectItem>
                        <SelectItem value="abandoned" className="py-3">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                        onChange={(e) => { field.onChange(e.target.value ? parseInt(e.target.value) : undefined); }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-12 justify-start text-left font-normal rounded-xl",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value && field.value instanceof Date && !isNaN(field.value.getTime())
                              ? format(field.value, "MMM d")
                              : "Pick date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          selected={field.value}
                          onSelect={(date) => { field.onChange(date || undefined); }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Spacer */}
            <div className="flex-1" />
            
            {/* Action buttons - sticky bottom */}
            <div className="flex flex-col gap-3 pt-4 pb-safe-bottom sticky bottom-0 bg-background">
              {/* Top row: History + Delete */}
              <div className="flex gap-2">
                {onViewHistory && (
                  <Button type="button" variant="outline" className="h-12 rounded-xl flex-1" onClick={onViewHistory}>
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="h-12 rounded-xl flex-1" data-testid="button-delete-task">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-lg">Delete task?</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm">
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-3">
                      <AlertDialogCancel className="flex-1 h-12 rounded-xl m-0">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete} 
                        className="flex-1 h-12 rounded-xl m-0 bg-destructive text-destructive-foreground active:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              
              {/* Bottom row: Cancel + Save */}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { onOpenChange(false); }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateTask.isPending} 
                  className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
                  data-testid="button-save-task"
                >
                  {updateTask.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
