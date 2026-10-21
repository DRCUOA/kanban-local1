import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Which edge of its trigger a menu hangs from on a wide screen. A phone
 * ignores this and opens the menu centred.
 */
export type MenuAnchor = 'below-start' | 'below-end' | 'above-start' | 'above-end';

const ANCHOR_CLASS: Record<MenuAnchor, string> = {
  'below-start': 'lg:left-0 lg:top-full lg:mt-2',
  'below-end': 'lg:right-0 lg:top-full lg:mt-2',
  'above-start': 'lg:bottom-full lg:left-0 lg:mb-2',
  'above-end': 'lg:bottom-full lg:right-0 lg:mb-2',
};

export interface MenuPanelProps {
  open: boolean;
  onClose: () => void;
  /** Wide screens: the trigger edge the panel hangs from. */
  anchor: MenuAnchor;
  /** Wide screens: the panel's width class. A phone sizes it to the screen. */
  widthClass?: string;
  /** Accessible name of the menu. */
  label?: string;
  /** Test id of the menu; the element that places it gets `<testId>-placement`. */
  testId?: string;
  /** Pinned under the list, outside the scroll area. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The surface every tap-to-open menu shares (More, Filing). Its trigger renders it inside a `relative` wrapper.
 *
 * On a phone the panel is a card centred over the dimmed page, wherever the
 * trigger sits: a dropdown hung from a button near a screen edge ran off the
 * screen. From the tablet breakpoint it is the usual dropdown anchored to the
 * trigger. A tap on the backdrop or Escape closes it.
 */
export function MenuPanel({
  open,
  onClose,
  anchor,
  widthClass = 'lg:w-52',
  label,
  testId,
  footer,
  children,
}: MenuPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        data-testid="menu-panel-backdrop"
      />
      <div
        className={cn(
          // Phone: centre the card in the viewport; the wrapper itself lets
          // taps through to the backdrop.
          'pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6',
          // Wide: a dropdown on the trigger's edge.
          'lg:pointer-events-auto lg:absolute lg:inset-auto lg:block lg:p-0',
          ANCHOR_CLASS[anchor],
        )}
        data-testid={testId ? `${testId}-placement` : undefined}
      >
        <div
          role="menu"
          aria-label={label}
          data-testid={testId}
          className={cn(
            // Leaves the bottom nav's height clear beneath a full-height card.
            'pointer-events-auto flex max-h-[calc(100dvh-10rem)] w-full max-w-xs flex-col neo-raised elevation-overlay rounded-md p-1.5',
            'animate-in fade-in-0 zoom-in-95',
            // Wide screens: the panel hangs below the header and must clear the
            // bottom nav as well, or its last rows (and its footer) render
            // underneath the bar and cannot be reached.
            'lg:max-h-[calc(100dvh-10rem)] lg:max-w-none lg:rounded-md lg:animate-slide-up',
            widthClass,
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {/* Outside the scroll area on purpose: a footer that scrolls away
              with a long list is a footer nobody ever sees. */}
          {footer !== undefined && <div className="shrink-0">{footer}</div>}
        </div>
      </div>
    </>
  );
}
