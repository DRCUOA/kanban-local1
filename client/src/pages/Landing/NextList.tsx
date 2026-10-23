import type { ReactNode } from 'react';

/** Rows shown before "and N more": a glance at what is ahead, not the whole of it. */
export const NEXT_PREVIEW = 6;

/**
 * Under the stones: what GO will lead to. A caps label and its count over a
 * hairline, then a few rows; the rest are counted, not listed.
 */
export function NextList({
  title,
  count,
  rows,
  empty,
  testId,
}: {
  title: string;
  /** The count beside the label, as it should read ("14", "3 tasks"). */
  count: string;
  rows: {
    key: string | number;
    glyph: ReactNode;
    title: string;
    meta?: string;
    trailing?: ReactNode;
  }[];
  /** Said when there are no rows. */
  empty: string;
  testId: string;
}) {
  const shown = rows.slice(0, NEXT_PREVIEW);
  const more = rows.length - shown.length;
  return (
    <section aria-label={title} data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border-strong/70 pb-1.5">
        <h2 className="label-caps">{title}</h2>
        <span className="text-xs font-semibold tabular-nums text-foreground">{count}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {shown.map((row) => (
            <li key={row.key} className="flex min-h-[3.25rem] items-center gap-3 py-2">
              <span className="flex w-6 shrink-0 justify-center">{row.glyph}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {row.title}
                </span>
                {row.meta && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {row.meta}
                  </span>
                )}
              </span>
              {row.trailing}
            </li>
          ))}
          {more > 0 && (
            <li className="py-2.5 text-xs text-muted-foreground">
              and {more} more along the strip
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
