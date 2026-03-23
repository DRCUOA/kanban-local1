/* eslint-disable @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { List, CircleDot, Focus } from 'lucide-react';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { cn } from '@/lib/utils';
import { MoreActionsMenu } from './MoreActionsMenu';

export interface DashboardBottomNavProps {
  viewMode: 'detail' | 'summary';
  focusMode: boolean;
  onSetViewMode: (mode: 'detail' | 'summary') => void;
  onToggleFocusMode: () => void;
  onArchive: () => void;
  onAdmin: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function DashboardBottomNav({
  viewMode,
  focusMode,
  onSetViewMode,
  onToggleFocusMode,
  onArchive,
  onAdmin,
  onExport,
  onImport,
}: DashboardBottomNavProps) {
  const toggleNavBtn = (active: boolean) =>
    cn(
      'flex flex-col items-center gap-1 py-2 px-3 min-w-[4.25rem] rounded-xl transition-[color,box-shadow,background-color,transform] duration-200 active:scale-90',
      active
        ? cn(
            'text-muted-foreground bg-black/[0.04] dark:bg-white/[0.06]',
            'shadow-[2px_2px_6px_rgba(0,0,0,0.12),-1px_-1px_4px_rgba(255,255,255,0.28)]',
            'dark:shadow-[2px_2px_10px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]',
          )
        : 'text-foreground/80 hover:text-foreground',
    );

  return (
    <nav className="mobile-bottom-nav">
      <div className="flex items-center justify-around px-2 py-2">
        <button
          type="button"
          className={toggleNavBtn(viewMode === 'detail')}
          aria-pressed={viewMode === 'detail'}
          onClick={() => {
            onSetViewMode('detail');
          }}
        >
          <List className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium">Detail</span>
        </button>

        <button
          type="button"
          className={toggleNavBtn(viewMode === 'summary')}
          aria-pressed={viewMode === 'summary'}
          onClick={() => {
            onSetViewMode('summary');
          }}
        >
          <CircleDot className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium">Summary</span>
        </button>

        <CreateTaskDialog iconOnly />

        <button
          type="button"
          className={toggleNavBtn(focusMode)}
          aria-pressed={focusMode}
          onClick={onToggleFocusMode}
        >
          <Focus className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium">Focus</span>
        </button>

        <MoreActionsMenu
          onArchive={onArchive}
          onAdmin={onAdmin}
          onExport={onExport}
          onImport={onImport}
        />
      </div>
    </nav>
  );
}
