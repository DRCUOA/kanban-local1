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
  return (
    <nav className="mobile-bottom-nav">
      <div className="flex items-center justify-around px-2 py-2">
        <button
          className={cn(
            'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
            viewMode === 'detail' && 'text-primary',
          )}
          onClick={() => {
            onSetViewMode('detail');
          }}
        >
          <List className="h-5 w-5" />
          <span className="text-[10px] font-medium">Detail</span>
        </button>

        <button
          className={cn(
            'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
            viewMode === 'summary' && 'text-primary',
          )}
          onClick={() => {
            onSetViewMode('summary');
          }}
        >
          <CircleDot className="h-5 w-5" />
          <span className="text-[10px] font-medium">Summary</span>
        </button>

        <CreateTaskDialog iconOnly />

        <button
          className={cn(
            'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90',
            focusMode && 'text-primary',
          )}
          onClick={onToggleFocusMode}
        >
          <Focus className="h-5 w-5" />
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
