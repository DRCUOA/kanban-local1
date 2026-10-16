import { useMemo, useState } from 'react';
import { useOwners } from '@/hooks/use-owners';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, User } from 'lucide-react';
import { DEFAULT_OWNER_COLOR } from '@shared/constants';
import { cn } from '@/lib/utils';

export interface OwnerSelectorProps {
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  className?: string;
  /** Trigger label override when nothing is selected. */
  placeholder?: string;
}

/**
 * Picker for a task's owner.
 *
 * It offers owners and nothing else (EPIC-06 OWN-R10): there is no "add
 * ‘Rcih’" row, because a typo used to invent a person and now cannot. New
 * owners are created in Admin, where a name can also be corrected once for
 * every task that uses it. Archived owners are hidden unless this task is
 * already assigned to one (OWN-R8, OWN-R9).
 */
export function OwnerSelector({
  value,
  onChange,
  className,
  placeholder = 'Unassigned',
}: OwnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: owners } = useOwners();

  const selectable = useMemo(
    () => (owners ?? []).filter((owner) => !owner.archived || owner.id === value),
    [owners, value],
  );
  const selected = (owners ?? []).find((owner) => owner.id === value) ?? null;

  const trimmedQuery = query.trim().toLowerCase();
  const filtered =
    trimmedQuery.length === 0
      ? selectable
      : selectable.filter((owner) => owner.name.toLowerCase().includes(trimmedQuery));

  const commit = (next: number | null) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'flex-1 h-12 justify-between text-left font-normal rounded-md',
              !selected && 'text-muted-foreground',
            )}
            aria-label={selected ? `Owner: ${selected.name}` : 'Owner: choose'}
            data-testid="owner-selector-trigger"
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: selected.color ?? DEFAULT_OWNER_COLOR }}
                  aria-hidden
                />
              ) : (
                <User className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{selected ? selected.name : placeholder}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search owners"
              className="h-9 text-sm"
              data-testid="owner-selector-search"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {selectable.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No owners yet. Add one in Admin → Owners.
              </div>
            )}
            {selectable.length > 0 && filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No owner matches. Names are corrected in Admin → Owners.
              </div>
            )}
            {filtered.map((owner) => {
              const isSelected = owner.id === value;
              return (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => {
                    commit(owner.id);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-accent',
                    isSelected && 'bg-accent/50',
                  )}
                  data-testid={`owner-selector-item-${owner.id}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: owner.color ?? DEFAULT_OWNER_COLOR }}
                      aria-hidden
                    />
                    <span className="truncate">{owner.name}</span>
                    {owner.archived && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">archived</span>
                    )}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
          {value != null && (
            <div className="border-t">
              <button
                type="button"
                onClick={() => {
                  commit(null);
                }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground hover:bg-accent"
                data-testid="owner-selector-clear"
              >
                <X className="h-4 w-4" />
                Clear owner
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
