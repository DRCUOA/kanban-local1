import { useState } from 'react';
import { Archive, CheckCircle2, FolderInput, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { useNavDropSlots } from '@/components/nav-drop-slots';
import { filingTargets } from '@/lib/filing-targets';
import { ROUTES } from '@shared/constants';
import { useStages } from '@/hooks/use-stages';
import { cn } from '@/lib/utils';

/**
 * Three targets, all of them destinations for a task: Filing on the left, Add
 * in the middle, Bin on the right. The view toggles that used to sit here now
 * live in the header's More menu, and the board's done/archive band is gone —
 * Filing is where a finished task goes, by tap or by drag.
 *
 * Each of Filing and Bin wraps an empty slot the board portals its drop target
 * into (see nav-drop-slots), which is why both buttons are positioned.
 */
export function DashboardBottomNav() {
  const [, navigate] = useLocation();
  const { data: stages = [] } = useStages();
  const { setFiling, setBin } = useNavDropSlots();
  const [filingOpen, setFilingOpen] = useState(false);
  const targets = filingTargets(stages);

  const navBtn =
    'flex flex-col items-center gap-1 py-2 px-3 min-w-[4.25rem] rounded-xl text-fg-secondary transition-[color,box-shadow,background-color,transform] duration-200 hover:text-foreground active:scale-90';

  return (
    <nav className="mobile-bottom-nav">
      <div className="flex items-center justify-around px-2 py-2">
        <div className="relative" ref={setFiling}>
          <button
            type="button"
            className={navBtn}
            aria-haspopup="menu"
            aria-expanded={filingOpen}
            onClick={() => {
              setFilingOpen(!filingOpen);
            }}
            data-testid="nav-filing"
          >
            <FolderInput className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium">Filing</span>
          </button>

          {filingOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => {
                  setFilingOpen(false);
                }}
              />
              <div
                role="menu"
                className="absolute bottom-full left-0 z-50 mb-2 w-52 animate-slide-up neo-raised rounded-xl p-2"
              >
                {targets.map((target) => (
                  <button
                    key={target.id}
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors active:bg-muted/50"
                    onClick={() => {
                      setFilingOpen(false);
                      navigate(target.href);
                    }}
                  >
                    {target.action === 'archive' ? (
                      <Archive className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{target.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <CreateTaskDialog iconOnly />

        <div className="relative" ref={setBin}>
          <button
            type="button"
            className={cn(navBtn, 'hover:text-destructive')}
            onClick={() => {
              navigate(ROUTES.BIN);
            }}
            data-testid="nav-bin"
          >
            <Trash2 className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium">Bin</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
