import { logger } from '@shared/logger';

/**
 * Clipboard writes with graceful degradation.
 *
 * Preferred path is a dual-flavour write (`text/html` + `text/plain`) so a
 * rich-text compose window keeps the formatting while a plain one still gets
 * readable text. Browsers without `ClipboardItem` fall back to plain text, and
 * non-secure contexts (where the async API is unavailable) fall back to a
 * hidden textarea plus `execCommand`.
 */

export interface ClipboardPayload {
  text: string;
  html?: string;
}

function copyViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Keep it off-screen and unfocusable-looking, but still selectable.
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only copy path in non-secure contexts, where navigator.clipboard is absent
    return document.execCommand('copy');
  } catch (error) {
    logger.warn('execCommand clipboard fallback failed', error);
    return false;
  } finally {
    textarea.remove();
  }
}

/** Copy a payload to the clipboard. Resolves false if every strategy failed. */
export async function copyToClipboard({ text, html }: ClipboardPayload): Promise<boolean> {
  // The DOM types declare `navigator.clipboard` as always present; it is not,
  // in non-secure contexts and older browsers.
  const clipboard = navigator.clipboard as Clipboard | undefined;

  if (html && typeof ClipboardItem !== 'undefined' && clipboard) {
    try {
      await clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch (error) {
      logger.warn('Rich clipboard write failed, falling back to plain text', error);
    }
  }

  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (error) {
      logger.warn('Plain clipboard write failed, falling back to execCommand', error);
    }
  }

  return copyViaExecCommand(text);
}
