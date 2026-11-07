import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '@shared/routes';
import {
  POLISH_MAX_INSTRUCTION,
  POLISH_PRESETS,
  type PolishResponse,
} from '@shared/description-polish';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ApiError, apiPost } from '@/lib/api';
import { sanitizeRichText, toRichHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface DescriptionPolishButtonProps {
  editor: Editor;
  /** The description has no words yet: there is nothing to polish. */
  empty: boolean;
}

interface Suggestion {
  html: string;
  filesMovedToEnd: number;
}

interface PolishCall {
  html: string;
  instruction: string;
}

/**
 * Controls inside the popover are marked busy, never `disabled`: a disabled
 * button that has focus drops it to the page, the task dialog's focus trap
 * then pulls it onto the dialog, and the popover takes that as focus leaving
 * it and closes, taking the answer with it. The handlers check the state.
 */
function busyClass(off: boolean): string | undefined {
  return off ? 'opacity-50 cursor-not-allowed' : undefined;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.body || error.statusText;
  return error instanceof Error ? error.message : 'Polish failed';
}

/**
 * The sparkles button in the description toolbar. It opens a popover where a
 * one-click instruction (Polish, Shorten, …) or a typed one is applied to the
 * description by the AI assistant (`POST /api/ai/polish`). The result is shown
 * as a suggestion; Replace puts it in the editor as one undoable step, and
 * nothing is saved until the task form is. A further instruction refines the
 * suggestion rather than starting again from the description.
 */
export function DescriptionPolishButton({ editor, empty }: DescriptionPolishButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [lastCall, setLastCall] = useState<PolishCall | null>(null);

  const run = async (call: PolishCall) => {
    setPending(true);
    setError(null);
    setLastCall(call);
    try {
      const res = await apiPost<PolishResponse>(api.descriptionPolish.run.path, call);
      const html = toRichHtml(res.html);
      if (!html) throw new Error('The AI sent back an empty description. Try again.');
      setSuggestion({ html, filesMovedToEnd: res.filesMovedToEnd });
      setInstruction('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  };

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending || empty) return;
    const source = suggestion?.html ?? sanitizeRichText(editor.getHTML());
    void run({ html: source, instruction: trimmed });
  };

  const clear = () => {
    setSuggestion(null);
    setLastCall(null);
    setError(null);
    setInstruction('');
  };

  const replace = () => {
    if (!suggestion || pending) return;
    // One transaction, so the editor's Undo brings the original back.
    editor.chain().focus().setContent(suggestion.html).run();
    clear();
    setOpen(false);
  };

  const discard = () => {
    clear();
    setOpen(false);
    editor.commands.focus();
  };

  const status = pending
    ? suggestion
      ? 'Refining the suggestion…'
      : 'Rewriting the description…'
    : (error ?? '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Polish with AI"
          title="Polish with AI"
          // Keeps the editor's selection while the popover opens.
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          className={cn(
            'h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors',
            open || suggestion
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          data-testid="button-polish-description"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-[min(28rem,calc(100vw-2rem))] space-y-3 p-3"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        // Radix closes the popover on Escape; the board's window-wide Esc
        // shortcut would also close the task dialog underneath.
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation();
        }}
        data-testid="popover-polish-description"
      >
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold">Polish</p>
          <p className="ml-auto text-[10px] text-muted-foreground">
            Sends this description to OpenAI. Nothing is saved until you save the task.
          </p>
        </div>

        {suggestion && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Suggestion</p>
            <div
              className="rich-text max-h-64 overflow-y-auto rounded-md border border-border bg-card px-3 py-2 text-sm"
              // Sanitized by toRichHtml when it arrived.
              dangerouslySetInnerHTML={{ __html: suggestion.html }}
              data-testid="polish-suggestion"
            />
            {suggestion.filesMovedToEnd > 0 && (
              <p className="text-xs text-muted-foreground">
                {suggestion.filesMovedToEnd === 1
                  ? 'An attached file the rewrite left out was put back at the end.'
                  : `${suggestion.filesMovedToEnd} attached files the rewrite left out were put back at the end.`}
              </p>
            )}
          </div>
        )}

        {empty && !suggestion ? (
          <p className="text-xs text-muted-foreground">
            Write something in the description first, then ask for a rewrite.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={instruction}
                onChange={(e) => {
                  setInstruction(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  // Enter here asks; it must not reach the task form or the board's shortcuts.
                  e.preventDefault();
                  e.stopPropagation();
                  ask(instruction);
                }}
                maxLength={POLISH_MAX_INSTRUCTION}
                placeholder={suggestion ? 'Refine the suggestion…' : 'Tell it what to do…'}
                aria-label={suggestion ? 'Instruction to refine the suggestion' : 'Instruction'}
                className="h-9 text-sm"
                readOnly={pending}
                data-testid="input-polish-instruction"
              />
              <Button
                type="button"
                size="sm"
                aria-disabled={pending || !instruction.trim() || undefined}
                className={cn('h-9', busyClass(pending || !instruction.trim()))}
                onClick={() => {
                  ask(instruction);
                }}
                data-testid="button-polish-go"
              >
                Go
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick instructions">
              {POLISH_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-disabled={pending || undefined}
                  className={cn('h-8 rounded-full px-3 text-xs', busyClass(pending))}
                  title={preset.instruction}
                  onClick={() => {
                    ask(preset.instruction);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </>
        )}

        <p
          className={cn(
            'min-h-4 text-xs',
            error && !pending ? 'text-destructive' : 'text-muted-foreground',
          )}
          aria-live="polite"
          data-testid="polish-status"
        >
          {status}
        </p>

        {suggestion && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={discard}>
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-disabled={pending || !lastCall || undefined}
              className={busyClass(pending || !lastCall)}
              onClick={() => {
                if (lastCall && !pending) void run(lastCall);
              }}
            >
              Try again
            </Button>
            <Button
              type="button"
              size="sm"
              aria-disabled={pending || undefined}
              className={busyClass(pending)}
              onClick={replace}
              data-testid="button-polish-replace"
            >
              Replace
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
