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

/** MIME types a file chip is allowed to carry as an inline data URL. */
export const FILE_CHIP_ACCEPTED_TYPES = ['image/'];

/** Max attachment size (raw bytes) — data URLs inflate ~33%, keep rows sane. */
export const FILE_CHIP_MAX_BYTES = 2.5 * 1024 * 1024;

function isSafeChipDataUrl(href: string): boolean {
  return FILE_CHIP_ACCEPTED_TYPES.some((prefix) => href.startsWith(`data:${prefix}`));
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
    // Also admit data:image/ URIs so file chips survive; the hook above then
    // strips data: hrefs from anything that is not a file chip.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|data:image\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
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

/** Read a File as a data URL. */
export function fileToDataUrl(file: File): Promise<string> {
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
