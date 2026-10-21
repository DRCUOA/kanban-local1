import { useId, type ReactNode } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterRowProps {
  label: string;
  /** What is chosen, by name: the chips a closed row shows on a phone. */
  summary: string[];
  /** Phone only: whether the row's choices are showing. From lg they always are. */
  open: boolean;
  onToggle: () => void;
  testId: string;
  children: ReactNode;
}

/**
 * One row of the landing page. From lg it is a labelled line of choices, the
 * label hanging in its own column; on a phone it is a section that opens and
 * closes, its header naming what is chosen so a closed row still says what it
 * does.
 */
export function FilterRow({ label, summary, open, onToggle, testId, children }: FilterRowProps) {
  const bodyId = useId();
  return (
    <section
      aria-label={label}
      className={cn(
        'neo-raised overflow-hidden',
        open && 'border-border-strong',
        'lg:grid lg:grid-cols-[10rem_1fr] lg:gap-6 lg:overflow-visible lg:rounded-none lg:border-0 lg:border-t lg:border-border-subtle lg:bg-transparent lg:py-5',
      )}
      data-testid={`filter-row-${testId}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-3 text-left lg:hidden"
        onClick={onToggle}
        data-testid={`filter-row-toggle-${testId}`}
      >
        <span className="label-caps shrink-0 text-[11px] text-foreground">{label}</span>
        <span className="flex min-w-0 flex-1 flex-wrap justify-start gap-1">
          {summary.map((name) => (
            <span
              key={name}
              className="max-w-full truncate rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground"
            >
              {name}
            </span>
          ))}
        </span>
        {open ? (
          <Minus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Plus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      <h2 className="label-caps hidden lg:block lg:pt-3.5">{label}</h2>

      <div
        id={bodyId}
        className={cn(
          open ? 'block' : 'hidden',
          'border-t border-border-subtle lg:block lg:border-0',
        )}
      >
        <div className="flex flex-col py-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2.5 lg:py-0">
          {children}
        </div>
      </div>
    </section>
  );
}

export interface FilterOptionProps {
  type?: 'checkbox' | 'radio';
  /** Radios that share a name are one group. */
  name?: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  /** Live tasks behind the choice. */
  count?: number;
  /** The project's or owner's colour dot. */
  color?: string | null;
  testId: string;
}

/**
 * A choice in a row. On a phone a full-width line with its box at the end,
 * where a thumb finds it; from lg a pill with the box first, so a row of them
 * reads as a line of tickable chips. The native input does the work, so it
 * keeps its keyboard and screen-reader behaviour; the box is drawn beside it.
 */
export function FilterOption({
  type = 'checkbox',
  name,
  label,
  checked,
  onChange,
  count,
  color,
  testId,
}: FilterOptionProps) {
  return (
    <label
      className={cn(
        'relative flex min-h-[3rem] cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors active:bg-muted/50',
        'lg:min-h-0 lg:justify-start lg:gap-2.5 lg:rounded-md lg:border lg:px-3.5 lg:py-2.5 lg:active:bg-transparent',
        checked
          ? 'lg:border-primary lg:bg-primary/10'
          : 'lg:border-border-strong/70 lg:hover:border-border-strong',
      )}
      data-testid={`filter-option-${testId}`}
      data-checked={checked}
    >
      <input
        type={type}
        name={name}
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span className="flex min-w-0 items-center gap-2">
        {color !== undefined && (
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              color === null && 'border border-dashed border-muted-foreground',
            )}
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden
          />
        )}
        <span className={cn('truncate', checked ? 'font-semibold' : 'font-medium')}>{label}</span>
        {count !== undefined && (
          <span className="shrink-0 text-xs text-muted-foreground" aria-label={`${count} tasks`}>
            {count}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'order-last flex h-5 w-5 shrink-0 items-center justify-center border transition-colors lg:order-first',
          type === 'radio' ? 'rounded-full' : 'rounded',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border-strong bg-background',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
        )}
      >
        {checked &&
          (type === 'radio' ? (
            <span className="h-2 w-2 rounded-full bg-primary-foreground" />
          ) : (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ))}
      </span>
    </label>
  );
}
