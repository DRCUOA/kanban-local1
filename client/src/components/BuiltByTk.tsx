import { cn } from '@/lib/utils';

export interface BuiltByTkProps {
  className?: string;
  /** Align the line; the menu centres it, a page footer hangs it left. */
  align?: 'start' | 'center';
}

/**
 * "Built by TK Workflow IT" — the one piece of this app that is not in the
 * board's own register.
 *
 * The wordmark is brand-fixed and set to the brand's own rules rather than the
 * app's: IBM Plex Sans, "TK" Medium 500 at 1.5% tracking in rust, "Workflow"
 * Bold 700 with no tracking, "IT" Medium 500 at 1.5% tracking. The three parts
 * are never re-spaced, recoloured, stretched or rotated, and the name is
 * always three spaced words with IT capitalised. Only the "Built by" prefix
 * takes the app's face, muted and small, so the credit reads as a credit.
 */
export function BuiltByTk({ className, align = 'center' }: BuiltByTkProps) {
  return (
    <p
      className={cn(
        'flex items-baseline gap-1.5 px-3 py-2 text-[10px] text-muted-foreground',
        align === 'center' ? 'justify-center' : 'justify-start',
        className,
      )}
      data-testid="built-by-tk"
    >
      <span>Built by</span>
      <span
        // One cap height of clear space around the lockup, per the brand's
        // clear-space rule.
        className="inline-flex items-baseline whitespace-nowrap px-[0.35em] text-[11px] leading-none"
        style={{ fontFamily: 'var(--font-brand)' }}
        aria-label="TK Workflow IT"
      >
        <span
          style={{ fontWeight: 500, letterSpacing: '0.015em', color: 'var(--tk-rust)' }}
          aria-hidden
        >
          TK
        </span>
        <span>&nbsp;</span>
        <span style={{ fontWeight: 700, letterSpacing: 0 }} aria-hidden>
          Workflow
        </span>
        <span>&nbsp;</span>
        <span style={{ fontWeight: 500, letterSpacing: '0.015em' }} aria-hidden>
          IT
        </span>
      </span>
    </p>
  );
}
