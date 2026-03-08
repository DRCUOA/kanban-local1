import { useEffect, useCallback } from 'react';
import { KEYBOARD_STATUS_MAP, type TaskStatusValue } from '@shared/constants';

export interface KeyboardShortcuts {
  onNewTask?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onMoveToStatus?: (status: TaskStatusValue) => void;
  onPriorityChange?: (direction: 'up' | 'down') => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Enter and Esc to work in inputs
        if (event.key === 'Enter' && shortcuts.onSave && !event.shiftKey) {
          event.preventDefault();
          shortcuts.onSave();
          return;
        }
        if (event.key === 'Escape' && shortcuts.onCancel) {
          event.preventDefault();
          shortcuts.onCancel();
          return;
        }
        return;
      }

      // N = New task
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey && shortcuts.onNewTask) {
        event.preventDefault();
        shortcuts.onNewTask();
        return;
      }

      // Enter = Save (when not in input)
      if (event.key === 'Enter' && shortcuts.onSave) {
        event.preventDefault();
        shortcuts.onSave();
        return;
      }

      // Esc = Cancel
      if (event.key === 'Escape' && shortcuts.onCancel) {
        event.preventDefault();
        shortcuts.onCancel();
        return;
      }

      // 1-4 = Move to status
      const mappedStatus = KEYBOARD_STATUS_MAP[event.key];
      if (mappedStatus && shortcuts.onMoveToStatus) {
        event.preventDefault();
        shortcuts.onMoveToStatus(mappedStatus);
        return;
      }

      // Cmd/Ctrl + ↑ ↓ = Change priority
      if ((event.metaKey || event.ctrlKey) && shortcuts.onPriorityChange) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          shortcuts.onPriorityChange('up');
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          shortcuts.onPriorityChange('down');
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
