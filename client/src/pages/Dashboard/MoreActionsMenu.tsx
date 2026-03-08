/* eslint-disable @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import { Archive, Settings, Download, Upload } from 'lucide-react';

export interface MoreActionsMenuProps {
  onArchive: () => void;
  onAdmin: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function MoreActionsMenu({ onArchive, onAdmin, onExport, onImport }: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-90"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-medium">More</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => {
              setOpen(false);
            }}
          />

          <div className="absolute bottom-full right-0 mb-2 z-50 neo-raised rounded-xl p-2 w-48 animate-slide-up">
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onArchive();
                setOpen(false);
              }}
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onAdmin();
                setOpen(false);
              }}
            >
              <Settings className="h-4 w-4" />
              Admin
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            >
              <Download className="h-4 w-4" />
              Export Tasks
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors"
              onClick={() => {
                onImport();
                setOpen(false);
              }}
            >
              <Upload className="h-4 w-4" />
              Import Tasks
            </button>
          </div>
        </>
      )}
    </div>
  );
}
