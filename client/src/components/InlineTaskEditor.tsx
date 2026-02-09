import { useState, useEffect, useRef } from "react";
import { Task } from "@shared/schema";
import { useUpdateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

interface InlineTaskEditorProps {
  task: Task;
  field: "title" | "description";
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function InlineTaskEditor({
  task,
  field,
  onSave,
  onCancel,
  className,
}: InlineTaskEditorProps) {
  const updateTask = useUpdateTask();
  const [value, setValue] = useState(task[field] || "");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value.trim() !== (task[field] || "")) {
      await updateTask.mutateAsync({
        id: task.id,
        [field]: value.trim(),
      });
    }
    setIsEditing(false);
    onSave?.();
  };

  const handleCancel = () => {
    setValue(task[field] || "");
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && field === "title") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Enter" && field === "description" && e.shiftKey === false) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    const displayValue = task[field] || "";
    const isEmpty = !displayValue;
    
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        onTouchStart={(e) => {
          // Prevent drag when tapping to edit
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "cursor-text active:bg-muted/30 rounded px-1 py-1 -mx-1 -my-0.5 transition-colors",
          isEmpty && "text-muted-foreground italic",
          className
        )}
      >
        {isEmpty ? `Tap to add ${field}...` : displayValue}
      </div>
    );
  }

  if (field === "description") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full resize-none border-none outline-none bg-transparent text-base",
          className
        )}
        rows={3}
        placeholder={`Enter ${field}...`}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "w-full border-none outline-none bg-transparent text-base",
        className
      )}
      placeholder={`Enter ${field}...`}
    />
  );
}
