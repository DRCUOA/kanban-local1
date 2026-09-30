import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PageHeaderProps {
  title: string;
  /** One short line under the title: a count, the project scope. */
  subtitle?: ReactNode;
  /** Icon for the tile beside the title on wide screens. */
  icon: ReactNode;
  onBack: () => void;
  backTestId?: string;
  /** Controls at the trailing end of the row. */
  actions?: ReactNode;
  /** An extra row under the title row (a search field). */
  children?: ReactNode;
}

/**
 * Header of the pages reached from the board (Filing, Bin, Archive, Admin).
 *
 * On a phone it is the one-row bar every page shares: back at the start, the
 * title centred, at most an icon or two at the end. The leading and trailing
 * groups split the leftover width equally, which is what centres the title.
 * From the tablet breakpoint the title sits beside its icon tile, left-aligned,
 * and the actions are pushed to the end.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  onBack,
  backTestId,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-3 py-2 lg:px-4 lg:py-3">
      <div className="flex items-center gap-2 lg:gap-3">
        <div className="flex min-w-0 flex-1 basis-0 items-center lg:flex-none">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 shrink-0 rounded-lg"
            aria-label="Back to the board"
            data-testid={backTestId}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <div
          className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg neo-raised lg:flex"
          aria-hidden
        >
          {icon}
        </div>

        <div className="min-w-0 text-center lg:flex-1 lg:text-left">
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[10px] leading-tight text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1 lg:flex-none lg:gap-2">
          {actions}
        </div>
      </div>
      {children}
    </header>
  );
}
