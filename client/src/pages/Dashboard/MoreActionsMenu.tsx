/* eslint-disable @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import {
  Archive,
  CircleDot,
  Columns,
  Download,
  Focus,
  List,
  Rows,
  Settings,
  Share2,
  Upload,
} from 'lucide-react';
import { MenuPanel } from '@/components/MenuPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

export interface MoreActionsMenuProps {
  viewMode: 'detail' | 'summary';
  focusMode: boolean;
  boardLayout: 'vertical' | 'horizontal';
  onSetViewMode: (mode: 'detail' | 'summary') => void;
  onToggleFocusMode: () => void;
  onToggleBoardLayout: () => void;
  onArchive: () => void;
  onAdmin: () => void;
  onShareBoard: () => void;
  onExport: () => void;
  onImport: () => void;
}

/**
 * Everything that changes how the board is *viewed*, plus the board-level
 * actions. It lives in the header now: the bottom bar is reserved for the three
 * places a task can go (Filing, Add, Bin). The panel opens centred on a phone
 * and hangs from the button from the tablet breakpoint (see MenuPanel).
 */
export function MoreActionsMenu({
  viewMode,
  focusMode,
  boardLayout,
  onSetViewMode,
  onToggleFocusMode,
  onToggleBoardLayout,
  onArchive,
  onAdmin,
  onShareBoard,
  onExport,
  onImport,
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const row = 'w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors';
  const toggleRow = (active: boolean) =>
    cn(row, active ? 'bg-primary/10 font-semibold text-primary' : 'active:bg-muted/50');
  const actionRow = cn(row, 'active:bg-muted/50');

  // Actions close the menu; view toggles keep it open so several can be tried
  // in a row without reopening it each time.
  const runAndClose = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Settings className="h-5 w-5" />
        <span className="sr-only">More</span>
      </button>

      <MenuPanel
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        anchor="below-end"
        label="Board and view options"
        testId="more-actions-menu"
      >
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          View
        </p>
        <button
          className={toggleRow(viewMode === 'detail')}
          aria-pressed={viewMode === 'detail'}
          onClick={() => {
            onSetViewMode('detail');
          }}
        >
          <List className="h-4 w-4" />
          Detail
        </button>
        <button
          className={toggleRow(viewMode === 'summary')}
          aria-pressed={viewMode === 'summary'}
          onClick={() => {
            onSetViewMode('summary');
          }}
        >
          <CircleDot className="h-4 w-4" />
          Summary
        </button>
        <button
          className={toggleRow(focusMode)}
          aria-pressed={focusMode}
          onClick={onToggleFocusMode}
        >
          <Focus className="h-4 w-4" />
          Focus
        </button>
        <button className={toggleRow(false)} onClick={onToggleBoardLayout}>
          {boardLayout === 'vertical' ? (
            <Columns className="h-4 w-4" />
          ) : (
            <Rows className="h-4 w-4" />
          )}
          {boardLayout === 'vertical' ? 'Horiz' : 'Vert'}
        </button>

        <div className="my-1 border-t border-border-subtle" />

        <ThemeToggle variant="row" />
        <button className={actionRow} onClick={runAndClose(onArchive)}>
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button className={actionRow} onClick={runAndClose(onAdmin)}>
          <Settings className="h-4 w-4" />
          Admin
        </button>
        <button className={actionRow} onClick={runAndClose(onShareBoard)}>
          <Share2 className="h-4 w-4" />
          Share Board
        </button>
        <button className={actionRow} onClick={runAndClose(onExport)}>
          <Download className="h-4 w-4" />
          Export Tasks
        </button>
        <button className={actionRow} onClick={runAndClose(onImport)}>
          <Upload className="h-4 w-4" />
          Import Tasks
        </button>
      </MenuPanel>
    </div>
  );
}
