/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect, useState } from 'react';
import type { Task, Stage, SubStage } from '@shared/schema';
import {
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { useUpdateTask, useArchiveTask } from '@/hooks/use-tasks';
import { getStatusFromStageName } from '@shared/constants';

export interface UseKanbanDragDropParams {
  tasks: Task[];
  sortedStages: Stage[];
  allSubStages: SubStage[];
}

export function useKanbanDragDrop({ tasks, sortedStages, allSubStages }: UseKanbanDragDropParams) {
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState(tasks);
  const [isOverArchive, setIsOverArchive] = useState(false);

  useEffect(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  // Custom collision detection: prioritize archive zone using both pointer-within
  // and rect-intersection checks, then pointerWithin for columns, then closestCenter.
  // Using pointerWithin first for archive ensures detection when the pointer is
  // directly over the zone, regardless of scroll position or dragged element size.
  const collisionDetection: CollisionDetection = (args) => {
    const { droppableContainers } = args;
    const archiveContainers = droppableContainers.filter(
      (c) => c.id === 'archive' || String(c.id) === 'archive',
    );
    if (archiveContainers.length > 0) {
      const archivePointerCollisions = pointerWithin({
        ...args,
        droppableContainers: archiveContainers,
      });
      if (archivePointerCollisions.length > 0) {
        return archivePointerCollisions;
      }
      const archiveRectCollisions = rectIntersection({
        ...args,
        droppableContainers: archiveContainers,
      });
      if (archiveRectCollisions.length > 0) {
        return archiveRectCollisions;
      }
    }
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCenter(args);
  };

  // PointerSensor (unified touch/mouse via Pointer Events API) is tried first for
  // broad mobile-browser compatibility. TouchSensor is the fallback for devices
  // where PointerEvents are incomplete, and MouseSensor covers legacy desktop.
  // delay = long-press to differentiate from scroll; tolerance is generous to
  // accommodate natural finger tremor on phones/tablets.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    const isArchive =
      over?.id === 'archive' ||
      String(over?.id) === 'archive' ||
      over?.data?.current?.type === 'archive';
    setIsOverArchive(!!isArchive);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setIsOverArchive(false);

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = activeTasks.find((t) => t.id === active.id);

    const isArchive =
      over.id === 'archive' ||
      String(over.id) === 'archive' ||
      over.data?.current?.type === 'archive';
    if (isArchive && activeTask) {
      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
      setActiveTasks((prev) => prev.filter((t) => t.id !== activeTask.id));
      archiveTask.mutate(activeTask.id, {
        onError: () => {
          setActiveTasks((prev) => [...prev, activeTask]);
        },
      });
      setActiveId(null);
      return;
    }

    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    const overId = typeof overContainerId === 'string' ? overContainerId : overContainerId;

    const isSubStage =
      over.data?.current?.type === 'SubStage' ||
      (typeof overId === 'string' && /^\d+-\w+/.test(overId));

    if (activeTask && isSubStage) {
      let stageId: number;
      let subStageTag: string;

      if (over.data?.current?.type === 'SubStage') {
        subStageTag = over.data.current.subStageTag;
        const match = /^(\d+)-(.+)$/.exec(String(over.id));
        stageId = match ? parseInt(match[1]!) : activeTask.stageId;
      } else if (typeof overId === 'string') {
        const match = /^(\d+)-(.+)$/.exec(overId);
        if (match) {
          stageId = parseInt(match[1]!);
          subStageTag = match[2]!;
        } else {
          stageId = activeTask.stageId;
          subStageTag = '';
        }
      } else {
        stageId = activeTask.stageId;
        subStageTag = '';
      }

      const stageSubStages = allSubStages.filter((ss) => ss.stageId === stageId);
      const stageSubStageTags = stageSubStages.map((ss) => ss.tag);
      const currentTags = activeTask.tags || [];
      const filteredTags = currentTags.filter((tag) => !stageSubStageTags.includes(tag));
      const newTags = [...filteredTags, subStageTag];

      const targetStage = sortedStages.find((s) => s.id === stageId);
      if (targetStage && activeTask.stageId !== stageId) {
        const newStatus = getStatusFromStageName(targetStage.name);
        setActiveTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id ? { ...t, stageId, status: newStatus, tags: newTags } : t,
          ),
        );
        updateTask.mutate({ id: activeTask.id, stageId, status: newStatus, tags: newTags });
      } else {
        setActiveTasks((prev) =>
          prev.map((t) => (t.id === activeTask.id ? { ...t, tags: newTags } : t)),
        );
        updateTask.mutate({ id: activeTask.id, tags: newTags });
      }

      setActiveId(null);
      return;
    }

    // overContainerId may be a number (from useDroppable) or string (from SortableContext)
    const parsedStageId =
      typeof overContainerId === 'number'
        ? overContainerId
        : typeof overContainerId === 'string' && /^\d+$/.test(overContainerId)
          ? parseInt(overContainerId, 10)
          : null;

    if (activeTask && parsedStageId !== null) {
      const newStageId = parsedStageId;
      const newStage = sortedStages.find((s) => s.id === newStageId);

      if (activeTask.stageId !== newStageId && newStage) {
        const newStatus = getStatusFromStageName(newStage.name);
        let newTags = activeTask.tags || [];
        const newStageSubStages = allSubStages.filter((ss) => ss.stageId === newStageId);
        if (newStageSubStages.length === 0) {
          const allSubStageTags = allSubStages.map((ss) => ss.tag);
          newTags = newTags.filter((tag) => !allSubStageTags.includes(tag));
        } else {
          const otherStageSubStageTags = allSubStages
            .filter((ss) => ss.stageId !== newStageId)
            .map((ss) => ss.tag);
          const newStageSubStageTags = newStageSubStages.map((ss) => ss.tag);
          newTags = newTags.filter(
            (tag) => !otherStageSubStageTags.includes(tag) || newStageSubStageTags.includes(tag),
          );
        }

        setActiveTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id
              ? {
                  ...t,
                  stageId: newStageId,
                  status: newStatus,
                  tags: newTags.length > 0 ? newTags : null,
                }
              : t,
          ),
        );
        updateTask.mutate({
          id: activeTask.id,
          stageId: newStageId,
          status: newStatus,
          tags: newTags.length > 0 ? newTags : null,
        });
      }
    }

    setActiveId(null);
  }

  return {
    activeId,
    activeTasks,
    isOverArchive,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
