import { Task, type TaskHistoryEntry } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Clock, Archive, CheckCircle2, Circle, XCircle } from "lucide-react";

interface TaskHistoryModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusIcons = {
  backlog: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  abandoned: XCircle,
  archived: Archive,
};

const statusLabels = {
  backlog: "Backlog",
  in_progress: "In Progress",
  done: "Done",
  abandoned: "Abandoned",
  archived: "Archived",
};

export function TaskHistoryModal({
  task,
  open,
  onOpenChange,
}: TaskHistoryModalProps) {
  if (!task) return null;

  const history: TaskHistoryEntry[] = task.history || [];
  const createdDate = new Date(task.createdAt || new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg leading-tight pr-8">
            History: {task.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto scroll-container space-y-3 mt-3">
          {/* Created */}
          <div className="flex items-start gap-3 pb-3 border-b border-border/50">
            <div className="mt-0.5">
              <Circle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Task Created</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {format(createdDate, "PPpp")}
              </div>
            </div>
          </div>

          {/* History entries */}
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No status changes recorded yet.
            </div>
          ) : (
            history.map((entry, index) => {
              const StatusIcon = statusIcons[entry.status as keyof typeof statusIcons] || Circle;
              const statusLabel = statusLabels[entry.status as keyof typeof statusLabels] || entry.status;
              const entryDate = new Date(entry.timestamp);

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0"
                >
                  <div className="mt-0.5">
                    <StatusIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      Moved to {statusLabel}
                    </div>
                    {entry.note && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {entry.note}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(entryDate, "PPpp")}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Current status if archived */}
          {task.archived && (
            <div className="flex items-start gap-3 pt-3 border-t border-border/50">
              <div className="mt-0.5">
                <Archive className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Currently Archived</div>
                {task.updatedAt && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(task.updatedAt), "PPpp")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
