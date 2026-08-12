import { AudioLines, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DictationButtonProps {
  listening: boolean;
  /** False when the browser has no Web Speech API — the button then explains the macOS fallback. */
  supported: boolean;
  onClick: () => void;
  /** Field name used in the accessible label, e.g. "title". */
  fieldLabel: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Presentational mic control for voice dictation.
 *
 * Idle shows a microphone; while listening it swaps to an animated sound-wave
 * so the recording state is obvious at a glance. State lives in
 * `useSpeechDictation` — this component only renders it.
 */
export function DictationButton({
  listening,
  supported,
  onClick,
  fieldLabel,
  className,
  'data-testid': testId,
}: DictationButtonProps) {
  const label = listening ? `Stop dictating ${fieldLabel}` : `Dictate ${fieldLabel}`;
  const Icon = listening ? AudioLines : Mic;

  return (
    <button
      type="button"
      onClick={onClick}
      // Keep focus (and the caret) in the field the dictation is aimed at.
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      aria-label={label}
      aria-pressed={listening}
      title={supported ? label : `${label} (uses macOS Dictation in this browser)`}
      className={cn(
        'h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors',
        listening
          ? 'bg-destructive text-destructive-foreground animate-pulse'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        !supported && 'opacity-60',
        className,
      )}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
