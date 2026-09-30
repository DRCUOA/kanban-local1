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
  children: ReactNode;
}

/**
 * The surface every tap-to-open menu shares (More, the project selector,
 * Filing). Its trigger renders it inside a `relative` wrapper.
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
            'pointer-events-auto max-h-[calc(100dvh-10rem)] w-full max-w-xs overflow-y-auto neo-raised rounded-2xl p-2',
            'animate-in fade-in-0 zoom-in-95',
            'lg:max-h-[calc(100dvh-5rem)] lg:max-w-none lg:rounded-xl lg:animate-slide-up',
            widthClass,
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
