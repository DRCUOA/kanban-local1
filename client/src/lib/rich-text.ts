import DOMPurify from 'dompurify';
import { markdownToHtml } from './markdown';

/**
 * Rich-text helpers for task descriptions.
 *
 * Descriptions are stored as sanitized HTML produced by the TipTap editor.
 * Legacy tasks (and imported data) may still hold plain text, so every
 * consumer goes through these helpers to convert/sanitize consistently.
 * Plain text is read as Markdown, so descriptions written elsewhere show up
 * formatted rather than as raw `**` and `-` markers.
 */

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'code',
  'pre',
  'hr',
  'span',
  // Markdown `~~strike~~` renders as <del>; TipTap reads it back as <s>.
  'del',
  'strike',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'data-file-chip',
  'data-file-name',
  'data-file-type',
  'class',
];

/**
 * MIME types a file chip is allowed to carry as an inline data URL. Entries
 * ending in `/` or `.` are prefixes; the rest must match exactly. Chips are
 * previewed as images or downloaded, never rendered as pages, but anything a
 * browser would run (HTML, XHTML, scripts) stays off the list regardless.
 */
export const FILE_CHIP_ACCEPTED_TYPES = [
  'image/',
  'audio/',
  'video/',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/rtf',
  'application/rtf',
  'application/json',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.',
  'application/vnd.oasis.opendocument.',
  'application/vnd.apple.',
  'application/zip',
  'application/x-zip-compressed',
];

/**
 * MIME type by extension, for files the browser reports with no type, a
 * generic one (`application/octet-stream`) or a vendor alias not on the list
 * above — e.g. `.md` on most systems, or Apple's `x-iwork-*` types.
 */
const FILE_CHIP_EXTENSION_TYPES: Record<string, string> = {
  txt: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  rtf: 'application/rtf',
  json: 'application/json',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  pages: 'application/vnd.apple.pages',
  numbers: 'application/vnd.apple.numbers',
  key: 'application/vnd.apple.keynote',
  zip: 'application/zip',
  heic: 'image/heic',
  heif: 'image/heif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/** `accept` value for the attachment picker: every listed type and extension. */
export const FILE_CHIP_ACCEPT = [
  ...FILE_CHIP_ACCEPTED_TYPES.filter((t) => !t.endsWith('.')).map((t) => t.replace(/\/$/, '/*')),
  ...Object.keys(FILE_CHIP_EXTENSION_TYPES).map((ext) => `.${ext}`),
].join(',');

/** Max attachment size (raw bytes) — data URLs inflate ~33%, keep rows sane. */
export const FILE_CHIP_MAX_BYTES = 2.5 * 1024 * 1024;

/** True when a file chip may carry this MIME type. */
export function isAcceptedFileChipType(type: string): boolean {
  const mime = type.trim().toLowerCase();
  if (!mime) return false;
  return FILE_CHIP_ACCEPTED_TYPES.some((accepted) => {
    const isPrefix = accepted.endsWith('/') || accepted.endsWith('.');
    return isPrefix ? mime.startsWith(accepted) : mime === accepted;
  });
}

/**
 * The MIME type to store an attachment under, or null when it can't be
 * attached. The browser's type wins when it is accepted; otherwise the file
 * extension decides. Either way the stored type is one on the list above.
 */
export function resolveFileChipType(name: string, type: string): string | null {
  if (isAcceptedFileChipType(type)) return type.trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  return FILE_CHIP_EXTENSION_TYPES[ext] ?? null;
}

function isSafeChipDataUrl(href: string): boolean {
  const mime = /^data:([^;,]*)[;,]/i.exec(href)?.[1];
  return mime !== undefined && isAcceptedFileChipType(mime);
}

function isSafeLinkHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href.trim());
}

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return;
    const href = node.getAttribute('href') ?? '';
    if (node.hasAttribute('data-file-chip')) {
      // File chips: only inline data URLs of accepted types survive.
      if (!isSafeChipDataUrl(href)) {
        node.removeAttribute('href');
      }
      node.setAttribute('class', 'file-chip');
    } else {
      // Regular links: http(s)/mailto/tel only, always opened safely.
      if (!isSafeLinkHref(href)) {
        node.removeAttribute('href');
      }
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/** Sanitize description HTML for storage or rendering. */
export function sanitizeRichText(html: string): string {
  installHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    // Also admit data: URIs so file chips survive; the hook above then keeps
    // them only on chips of an accepted type and strips them everywhere else.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|data:[a-z]+\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/** True when the value contains HTML markup (vs. legacy plain text). */
export function looksLikeRichText(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

/**
 * Convert legacy plain-text descriptions into editor-compatible HTML, reading
 * any Markdown they contain. Prose without Markdown syntax comes out as the
 * same paragraphs and line breaks it always did.
 */
export function plainTextToRichHtml(text: string): string {
  if (!text) return '';
  return markdownToHtml(text);
}

/** Normalize any stored description (HTML or plain text) to sanitized HTML. */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return '';
  return sanitizeRichText(looksLikeRichText(value) ? value : plainTextToRichHtml(value));
}

/**
 * Flatten a description to plain text for previews, tooltips and search.
 * File chips become "[name]"; block boundaries become line breaks.
 */
export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  // Plain text goes through Markdown first so text previews and search see the
  // rendered words, not the `**` and `-` around them.
  const html = looksLikeRichText(value) ? value : markdownToHtml(value);
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n');
  const div = document.createElement('div');
  div.innerHTML = sanitizeRichText(withBreaks);
  div.querySelectorAll('a[data-file-chip]').forEach((chip) => {
    chip.textContent = `[${chip.getAttribute('data-file-name') ?? 'attachment'}]`;
  });
  return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** True when a description has no visible content. */
export function isRichTextEmpty(value: string | null | undefined): boolean {
  if (!value) return true;
  if (!looksLikeRichText(value)) return value.trim().length === 0;
  if (/<a[^>]*data-file-chip/i.test(value)) return false;
  return richTextToPlainText(value).length === 0;
}

/** Read a File (or Blob) as a data URL. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}
