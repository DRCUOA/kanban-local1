import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface StageHeadersProps {
  tasks: Task[];
}

const defaultStageColors = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
];

const getDefaultStageColor = (index: number): string => {
  return defaultStageColors[index % defaultStageColors.length];
};

export function StageHeaders({ tasks }: StageHeadersProps) {
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

  const sortedStages = useMemo(() => {
    return [...stages].sort((a: any, b: any) => a.order - b.order);
  }, [stages]);

  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage: any, index: number) => {
      const color = stage.color || getDefaultStageColor(index);
      map.set(stage.id, color);
    });
    return map;
  }, [sortedStages]);

  const activeTasks = tasks.filter(t => !t.archived);

  return (
    <div className="sticky top-[200px] md:top-[140px] z-40 flex-shrink-0 bg-background/95 backdrop-blur-sm mb-4 -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6 pt-2 border-t border-border/50">
      <div className="flex flex-col lg:flex-row gap-8">
        {sortedStages.map((stage: any) => {
          const stageColor = stageColorMap.get(stage.id) || defaultStageColors[0];
          const stageCount = activeTasks.filter((t) => t.stageId === stage.id).length;
          return (
            <div key={`header-${stage.id}`} className="flex-1 min-w-0">
              <div className="p-5 flex items-center justify-between rounded-t-[3rem] neo-container">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: stageColor }}
                  />
                  <h2 className="font-display font-bold text-sm uppercase tracking-wider text-foreground">
                    {stage.name}
                  </h2>
                </div>
                <Badge variant="secondary" className="font-mono text-xs neo-pressed rounded-lg px-2 py-1">
                  {stageCount}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
