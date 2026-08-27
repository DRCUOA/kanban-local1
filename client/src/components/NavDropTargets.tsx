import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { Archive, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BIN_DROPPABLE_ID, FILING_DROPPABLE_ID, type FilingTarget } from '@/lib/filing-targets';
import { useNavDropSlots } from './nav-drop-slots';

/**
 * Drop targets for the two nav buttons. They are rendered by the board (so they
 * sit inside its `DndContext`) but portalled into the nav's slots, where each
 * covers its button with a `pointer-events-none` overlay — dnd-kit hit-tests
 * rects, not pointer events, so taps still reach the button underneath.
 *
 * Resting on Filing mid-drag opens its submenu; from there a micro-drag moves
 * the focus between rows and the drop applies whichever row is focused. Letting
 * go anywhere else lands on no target at all, so dnd-kit returns the card home.
 */
export interface NavDropTargetsProps {
  targets: FilingTarget[];
  /** Whether the drag has rested on Filing long enough to reveal the submenu. */
  filingMenuOpen: boolean;
  /** Droppable id currently under the pointer, when it is a nav target. */
  activeNavId: string | null;
}

export function NavDropTargets({ targets, filingMenuOpen, activeNavId }: NavDropTargetsProps) {
  const { filing, bin } = useNavDropSlots();

  return (
    <>
      {filing &&
        createPortal(
          <FilingDropZone targets={targets} menuOpen={filingMenuOpen} activeNavId={activeNavId} />,
          filing,
        )}
      {bin && createPortal(<BinDropZone active={activeNavId === BIN_DROPPABLE_ID} />, bin)}
    </>
  );
}

function FilingDropZone({
  targets,
  menuOpen,
  activeNavId,
}: {
  targets: FilingTarget[];
  menuOpen: boolean;
  activeNavId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: FILING_DROPPABLE_ID, data: { type: 'filing' } });
  // The button glows while the drag is anywhere in Filing's orbit — over the
  // button itself or over one of its rows.
  const active = activeNavId === FILING_DROPPABLE_ID || menuOpen;

  return (
    <>
      <div
        ref={setNodeRef}
        data-testid="filing-drop-zone"
        className={cn(
          'pointer-events-none absolute -inset-1 rounded-xl transition-all duration-150',
          active && 'bg-primary/15 ring-2 ring-primary/60',
        )}
      />
      {/* Deliberately not `animate-slide-up`: dnd-kit measures a droppable when
          it mounts, so a menu that slid into place would register its rows where
          they started, not where they end up — and the drag would aim at ghosts.
          Fading in leaves the geometry fixed from the first frame. */}
      {menuOpen && (
        <div
          data-testid="filing-drop-menu"
          className="pointer-events-none absolute bottom-full left-0 z-[60] mb-1 w-52 animate-in fade-in-0 duration-150 neo-raised rounded-xl p-2"
        >
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            File as
          </p>
          {targets.map((target) => (
            <FilingDropRow key={target.id} target={target} focused={activeNavId === target.id} />
          ))}
        </div>
      )}
    </>
  );
}

function FilingDropRow({ target, focused }: { target: FilingTarget; focused: boolean }) {
  const { setNodeRef } = useDroppable({
    id: target.id,
    data: { type: 'filing-target', action: target.action, stageId: target.stageId },
  });
  const Icon = target.action === 'archive' ? Archive : CheckCircle2;

  return (
    <div
      ref={setNodeRef}
      data-testid={`filing-drop-row-${target.action}`}
      aria-current={focused ? 'true' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg p-3 text-sm transition-colors',
        focused ? 'bg-primary/20 font-semibold text-primary' : 'text-fg-secondary',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{target.label}</span>
    </div>
  );
}

function BinDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: BIN_DROPPABLE_ID, data: { type: 'bin' } });

  return (
    <>
      <div
        ref={setNodeRef}
        data-testid="bin-drop-zone"
        className={cn(
          'pointer-events-none absolute -inset-1 rounded-xl transition-all duration-150',
          active && 'bg-destructive/15 ring-2 ring-destructive/60',
        )}
      />
      {active && (
        <div className="pointer-events-none absolute bottom-full right-0 z-[60] mb-1 flex w-max items-center gap-2 rounded-lg neo-raised px-3 py-2 text-xs font-semibold text-destructive">
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
          Drop to bin
        </div>
      )}
    </>
  );
}
