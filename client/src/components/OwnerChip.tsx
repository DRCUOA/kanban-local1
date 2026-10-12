import type { Owner } from '@shared/schema';
import { DEFAULT_OWNER_COLOR, TASK_OWNER_MAX_LEN } from '@shared/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface OwnerChipProps {
  owner: Pick<Owner, 'name' | 'key' | 'color'>;
  /** Show the full name even when it is longer than the card's budget. */
  full?: boolean;
  className?: string;
  testId?: string;
}

/**
 * The colour dot and label that says whose task this is.
 *
 * The colour never carries the meaning on its own: the chip always shows text
 * (EPIC-06 OWN-R29). Where the name is longer than the card's display budget
 * the short code stands in for it (OWN-R30), with the full name as the tooltip
 * either way.
 */
export function OwnerChip({
  owner,
  full = false,
  className,
  testId = 'owner-chip',
}: OwnerChipProps) {
  const tooLong = owner.name.length > TASK_OWNER_MAX_LEN;
  const label = !full && tooLong && owner.key ? owner.key : owner.name;
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 min-h-0 min-w-0 max-w-[140px] gap-1 px-1.5 py-0 text-xs font-normal touch-target-sm',
        className,
      )}
      title={owner.name}
      data-testid={testId}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: owner.color ?? DEFAULT_OWNER_COLOR }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
