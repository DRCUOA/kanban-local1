/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing -- shared with rest of client components */
import { useMemo, useState } from 'react';
import { TASK_OWNER_MAX_LEN } from '@shared/constants';
import { useOwners } from '@/hooks/use-owners';
import { Button } from '@/components/ui/button';
import { VoiceInput } from '@/components/VoiceInput';
import { appendTranscript } from '@/lib/dictation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OwnerSelectorProps {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Optional extra owners to merge in (e.g. unsaved value not yet in /api/tasks/owners). */
  extraOwners?: string[];
  className?: string;
  /** Trigger label override when nothing is selected. */
  placeholder?: string;
}

/**
 * Combobox-style picker for the free-form task `owner` field.
 *
 *   - Shows existing owners (from /api/tasks/owners) as selectable rows.
 *   - The same input box doubles as an "add new" — anything typed that doesn't
 *     match an existing owner can be committed as a new label, capped at
 *     TASK_OWNER_MAX_LEN characters.
 *   - A "Clear owner" row removes the assignment.
 */
export function OwnerSelector({
  value,
  onChange,
  extraOwners,
  className,
  placeholder = 'Unassigned',
}: OwnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: ownersFromApi } = useOwners();

  const allOwners = useMemo(() => {
    const set = new Set<string>();
    for (const o of ownersFromApi ?? []) {
      if (o && o.length > 0) set.add(o);
    }
    for (const o of extraOwners ?? []) {
      if (o && o.length > 0) set.add(o);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [ownersFromApi, extraOwners]);

  const trimmedQuery = query.trim();
  const exactMatch = allOwners.find(
    (o) => o.localeCompare(trimmedQuery, undefined, { sensitivity: 'base' }) === 0,
  );
  const filtered =
    trimmedQuery.length === 0
      ? allOwners
      : allOwners.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()));

  // Trim runtime input to the DB-enforced max so the UI never lets a user
  // submit something the server (or DB) is going to reject.
  const enforceLimit = (raw: string) => raw.slice(0, TASK_OWNER_MAX_LEN);

  const commit = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const handleAddNew = () => {
    if (trimmedQuery.length === 0) return;
    commit(enforceLimit(trimmedQuery));
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
              'flex-1 h-12 justify-between text-left font-normal rounded-xl',
              !value && 'text-muted-foreground',
            )}
            data-testid="owner-selector-trigger"
          >
            <span className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{value && value.length > 0 ? value : placeholder}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="p-2 border-b">
            <VoiceInput
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(enforceLimit(e.target.value));
              }}
              onDictate={(transcript) => {
                setQuery((current) => enforceLimit(appendTranscript(current, transcript)));
              }}
              fieldLabel="owner"
              micTestId="button-dictate-owner"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (exactMatch) commit(exactMatch);
                  else handleAddNew();
                }
              }}
              maxLength={TASK_OWNER_MAX_LEN}
              placeholder={`Search or add (max ${TASK_OWNER_MAX_LEN})`}
              className="h-9 text-sm"
              data-testid="owner-selector-search"
            />
            <div className="mt-1 text-[10px] text-muted-foreground text-right">
              {query.length}/{TASK_OWNER_MAX_LEN}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && trimmedQuery.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No owners yet. Type a name above to add one.
              </div>
            )}
            {filtered.map((o) => {
              const selected = value === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    commit(o);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent',
                    selected && 'bg-accent/50',
                  )}
                  data-testid={`owner-selector-item-${o}`}
                >
                  <span className="truncate">{o}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
            {trimmedQuery.length > 0 && !exactMatch && (
              <button
                type="button"
                onClick={handleAddNew}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-primary hover:bg-accent"
                data-testid="owner-selector-add-new"
              >
                <Plus className="h-4 w-4" />
                Add &ldquo;{trimmedQuery.slice(0, TASK_OWNER_MAX_LEN)}&rdquo;
              </button>
            )}
          </div>
          {value && (
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
