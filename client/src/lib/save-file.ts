import { logger } from '@shared/logger';

/**
 * File saving with graceful degradation, mirroring the clipboard helper.
 *
 * Preferred path is the File System Access API (`showSaveFilePicker`) so the
 * user picks where the file lands and gets a real "saved" signal. Browsers
 * without it (Firefox, Safari) fall back to a classic anchor download into the
 * default downloads folder.
 */

export interface SaveTextFileOptions {
  filename: string;
  content: string;
  mimeType: 'text/plain' | 'application/json';
  /** Human-readable label for the picker's file-type entry. */
  description?: string;
}

export type SaveTextFileResult =
  /** Written via the native picker; the file is confirmed on disk. */
  | 'saved'
  /** Anchor-download fallback; the browser owns it from here. */
  | 'downloaded'
  /** The user dismissed the native picker. Not an error. */
  | 'cancelled';

interface SaveFilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

/** Structural type: `showSaveFilePicker` is not in every TS DOM lib yet. */
type ShowSaveFilePicker = (options: {
  suggestedName?: string;
  types?: SaveFilePickerType[];
}) => Promise<{
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}>;

function nativePicker(): ShowSaveFilePicker | undefined {
  const picker = (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  return typeof picker === 'function' ? (picker.bind(window) as ShowSaveFilePicker) : undefined;
}

function extensionFor(mimeType: SaveTextFileOptions['mimeType']): string {
  return mimeType === 'application/json' ? '.json' : '.txt';
}

function downloadViaAnchor({ filename, content, mimeType }: SaveTextFileOptions): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Save text content as a file. Uses the native save-file picker where
 * supported and falls back to a standard browser download otherwise.
 */
export async function saveTextFile(options: SaveTextFileOptions): Promise<SaveTextFileResult> {
  const picker = nativePicker();

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: options.filename,
        types: [
          {
            description: options.description ?? 'Export file',
            accept: { [options.mimeType]: [extensionFor(options.mimeType)] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([options.content], { type: options.mimeType }));
      await writable.close();
      return 'saved';
    } catch (error) {
      // AbortError = the user closed the picker; anything else (permissions,
      // cross-origin frame, write failure) degrades to the anchor download.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      logger.warn('Native save picker failed, falling back to download', error);
    }
  }

  downloadViaAnchor(options);
  return 'downloaded';
}
