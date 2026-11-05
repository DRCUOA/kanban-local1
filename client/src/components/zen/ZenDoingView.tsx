import type React from 'react';
import { useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/RichTextContent';
import { isRichTextEmpty } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

export interface ZenDoingViewProps {
  open: boolean;
  /** The description as the Edit Task form holds it. Shown, never edited. */
  description: string | null | undefined;
  onMarkDone: () => void;
  /** Cancel doing: close and change nothing. Escape does the same. */
  onCancel: () => void;
  /** True while Mark done is saving; both ways out wait for it. */
  isMarkingDone: boolean;
  /** Why Mark done cannot run here (no Done column on the board), or null when it can. */
  markDoneBlockedReason: string | null;
  /** Where focus goes when Zen closes: the Edit Task dialog it opened from. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}

/**
 * Both ways out are present but quiet: muted ink, regular weight, no border or
 * fill until hovered. Quiet by colour and weight rather than by opacity, which
 * took the text below 4.5:1 on the dark ground; muted ink holds 6.4:1 dark and
 * 4.9:1 light.
 */
const quietButton =
  'h-11 min-h-11 px-4 text-sm font-normal text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Zen doing mode: the whole screen given to one task's description, read-only,
 * with Mark done and Cancel doing at its foot and nothing else.
 *
 * A dialog of its own above Edit Task, so Escape and the focus trap belong to
 * it and closing it lands back on Edit Task exactly as it was. Focus starts on
 * the reading area rather than on either button, so a stray Enter cannot mark
 * the task done.
 */
export function ZenDoingView({
  open,
  description,
  onMarkDone,
  onCancel,
  isMarkingDone,
  markDoneBlockedReason,
  returnFocusTo,
}: ZenDoingViewProps) {
  const readingRef = useRef<HTMLDivElement>(null);
  const empty = isRichTextEmpty(description ?? '');

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !isMarkingDone) onCancel();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            readingRef.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            // This Escape is Zen's. Left to travel, it reaches the board's
            // window-wide Esc shortcut, which closes Edit Task underneath.
            e.stopPropagation();
            if (isMarkingDone) e.preventDefault();
          }}
          // Radix would refocus whatever had focus before Zen opened, and in
          // Safari a pressed button never takes focus, so that is the page body.
          onCloseAutoFocus={(e) => {
            const target = returnFocusTo?.current;
            if (!target) return;
            e.preventDefault();
            target.focus({ preventScroll: true });
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-700"
          data-testid="zen-doing-view"
        >
          <DialogPrimitive.Title className="sr-only">Zen doing mode</DialogPrimitive.Title>

          <div
            ref={readingRef}
            tabIndex={-1}
            aria-label="Task description"
            className="min-h-0 flex-1 overflow-y-auto outline-none scroll-container"
          >
            <div className="mx-auto flex min-h-full w-full max-w-[64ch] flex-col justify-center px-6 py-16 sm:px-10">
              {empty ? (
                <p className="text-lg italic text-muted-foreground">No description</p>
              ) : (
                <RichTextContent
                  value={description}
                  className={cn(
                    'text-lg leading-relaxed sm:text-xl sm:leading-relaxed',
                    '[&_li+li]:mt-2 [&_li]:pl-1 [&_ol]:pl-7 [&_p+p]:mt-4 [&_ul]:pl-7',
                    '[&_ol+p]:mt-6 [&_ul+p]:mt-6',
                  )}
                  data-testid="zen-doing-description"
                />
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center justify-center gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
            <Button
              type="button"
              variant="ghost"
              className={quietButton}
              onClick={onCancel}
              disabled={isMarkingDone}
              data-testid="zen-doing-cancel"
            >
              Cancel doing
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(quietButton, 'hover:text-primary focus-visible:text-primary')}
              onClick={onMarkDone}
              disabled={isMarkingDone || markDoneBlockedReason !== null}
              title={markDoneBlockedReason ?? undefined}
              data-testid="zen-doing-mark-done"
            >
              <Check aria-hidden />
              {isMarkingDone ? 'Marking done…' : 'Mark done'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
