import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  /** Display style. `icon` = bare icon button; `row` = full-width menu row. */
  variant?: 'icon' | 'row';
  className?: string;
}

const NEXT_PREF: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const PREF_LABEL: Record<ThemePreference, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

/**
 * Three-way theme cycle: Light → Dark → System.
 * Renders as either a compact icon button (for headers) or a full-width row
 * (for action menus).
 */
export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
  const next = NEXT_PREF[preference];

  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;
  const label = PREF_LABEL[preference];
  const ariaLabel = `Theme: ${label}. Click to switch to ${PREF_LABEL[next]}.`;

  if (variant === 'row') {
    return (
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg text-sm active:bg-muted/50 transition-colors',
          className,
        )}
        onClick={() => {
          setPreference(next);
        }}
        aria-label={ariaLabel}
        data-testid="theme-toggle"
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('rounded-lg h-10 w-10', className)}
      onClick={() => {
        setPreference(next);
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid="theme-toggle"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </Button>
  );
}
