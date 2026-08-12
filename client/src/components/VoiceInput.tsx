import * as React from 'react';
import { Input } from '@/components/ui/input';
import { DictationButton } from '@/components/DictationButton';
import { useSpeechDictation } from '@/hooks/use-speech-dictation';
import { useToast } from '@/hooks/use-toast';
import { MACOS_DICTATION_HINT } from '@/lib/dictation';
import { cn } from '@/lib/utils';

export interface VoiceInputProps extends React.ComponentProps<'input'> {
  /** Receives each finalised phrase; the caller decides how to merge it in. */
  onDictate: (transcript: string) => void;
  /** Field name used in the mic button's accessible label, e.g. "title". */
  fieldLabel: string;
  /** data-testid for the mic button (the input keeps its own). */
  micTestId?: string;
}

/**
 * A text input with a dictation mic docked inside its right edge.
 *
 * Finalised phrases go to `onDictate`; interim words render underneath as live
 * feedback and are never written to the field.
 */
export const VoiceInput = React.forwardRef<HTMLInputElement, VoiceInputProps>(
  ({ onDictate, fieldLabel, micTestId, className, ...props }, forwardedRef) => {
    const { toast } = useToast();
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const { supported, listening, interim, toggle } = useSpeechDictation({
      onFinal: onDictate,
      onError: (message) => {
        toast({ title: 'Dictation', description: message, variant: 'destructive' });
      },
    });

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const handleMicClick = () => {
      if (!supported) {
        // macOS Dictation types into whatever is focused, so hand it the field.
        inputRef.current?.focus();
        toast({ title: 'Use macOS Dictation', description: MACOS_DICTATION_HINT });
        return;
      }
      inputRef.current?.focus();
      toggle();
    };

    return (
      <div className="w-full">
        <div className="relative w-full">
          <Input ref={setRefs} className={cn('pr-12', className)} {...props} />
          <DictationButton
            listening={listening}
            supported={supported}
            onClick={handleMicClick}
            fieldLabel={fieldLabel}
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            data-testid={micTestId}
          />
        </div>
        {listening && (
          <p className="mt-1 text-xs text-muted-foreground italic" aria-live="polite">
            {interim.trim().length > 0 ? interim : 'Listening…'}
          </p>
        )}
      </div>
    );
  },
);
VoiceInput.displayName = 'VoiceInput';
