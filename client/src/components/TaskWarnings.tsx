import { Task } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock } from "lucide-react";
import { isPast, isToday, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

interface TaskWarningsProps {
  tasks: Task[];
}

export function TaskWarnings({ tasks }: TaskWarningsProps) {
  const { data: stages = [] } = useQuery({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      const res = await fetch(api.stages.list.path);
      return res.json();
    },
  });

  const activeTasks = tasks.filter(t => !t.archived);
  
  // Helper to get status (from field or infer from stage name)
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
  
  const inProgressTasks = activeTasks.filter(t => getTaskStatus(t) === "in_progress");
  const highPriorityBacklog = activeTasks.filter(
    t => getTaskStatus(t) === "backlog" && (t.priority === "high" || t.priority === "critical")
  );
  
  const overdueTasks = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return isPast(due) && !isToday(due);
  });

  const staleTasks = activeTasks.filter(t => {
    if (!t.updatedAt) return false;
    const updated = new Date(t.updatedAt);
    const daysSinceUpdate = differenceInDays(new Date(), updated);
    return daysSinceUpdate >= 14;
  });

  const warnings = [];

  if (inProgressTasks.length > 3) {
    warnings.push({
      type: "info",
      icon: AlertCircle,
      title: "Many tasks in progress",
      message: `You have ${inProgressTasks.length} tasks in progress. Consider focusing on fewer tasks at once.`,
    });
  }

  if (highPriorityBacklog.length > 0) {
    warnings.push({
      type: "warning",
      icon: AlertCircle,
      title: "High-priority tasks in backlog",
      message: `${highPriorityBacklog.length} high-priority task${highPriorityBacklog.length > 1 ? "s" : ""} waiting in backlog.`,
    });
  }

  if (overdueTasks.length > 0) {
    warnings.push({
      type: "destructive",
      icon: Clock,
      title: "Overdue tasks",
      message: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} overdue.`,
    });
  }

  if (staleTasks.length > 0) {
    warnings.push({
      type: "info",
      icon: AlertCircle,
      title: "Stale tasks",
      message: `${staleTasks.length} task${staleTasks.length > 1 ? "s haven't" : " hasn't"} been updated in 14+ days. Consider reviewing or archiving.`,
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {warnings.map((warning, idx) => {
        const Icon = warning.icon;
        return (
          <Alert
            key={idx}
            className={cn(
              "border-l-4",
              warning.type === "destructive" && "border-l-red-500 bg-red-50 dark:bg-red-950/20",
              warning.type === "warning" && "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
              warning.type === "info" && "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
            )}
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">{warning.title}</AlertTitle>
            <AlertDescription className="text-xs mt-1">{warning.message}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
