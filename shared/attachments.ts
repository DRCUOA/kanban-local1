/**
 * Task attachments — files attached to a task description.
 *
 * A file is uploaded on its own (`POST /api/attachments`) and stored as a row
 * of `task_attachments`; the description references it through a file chip
 * whose href is `/api/attachments/:id`. When the description is saved the
 * server binds the referenced rows to the task and releases the ones it no
 * longer references; released rows and uploads that were never saved are
 * swept once they are older than `ATTACHMENT_ORPHAN_TTL_MS`.
 *
 * Shared because both sides need the same answers: the client to filter the
 * picker and refuse a file early, the server to validate an upload and to
 * decide how to serve it.
 */

/** Largest file accepted. Bytes live in a `bytea` column, so this bounds a row as well as a request. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** An upload that no saved description references is deleted after this long. */
export const ATTACHMENT_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

export const ATTACHMENT_FILENAME_MAX_LEN = 255;

/**
 * Upload request headers. The body is the raw file sent as
 * `application/octet-stream` so the JSON body parser leaves it alone; the
 * file's own type and its URL-encoded name travel in these.
 */
export const ATTACHMENT_TYPE_HEADER = 'x-attachment-type';
export const ATTACHMENT_NAME_HEADER = 'x-attachment-name';

/** Every attachment URL is this prefix followed by the row id. */
export const ATTACHMENT_URL_PREFIX = '/api/attachments/';

/**
 * MIME types an attachment may have. Entries ending in `/` or `.` are
 * prefixes; the rest must match exactly. Anything a browser would run when
 * opened (HTML, XHTML, scripts) stays off the list.
 */
export const ATTACHMENT_ACCEPTED_TYPES = [
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
 * MIME type by extension, for files a browser reports with no type, a
 * generic one (`application/octet-stream`) or a vendor alias not on the list
 * above — e.g. `.md` on most systems, or Apple's `x-iwork-*` types.
 */
const ATTACHMENT_EXTENSION_TYPES: Record<string, string> = {
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

/** `accept` value for the file picker: every listed type and extension. */
export const ATTACHMENT_ACCEPT = [
  ...ATTACHMENT_ACCEPTED_TYPES.filter((t) => !t.endsWith('.')).map((t) => t.replace(/\/$/, '/*')),
  ...Object.keys(ATTACHMENT_EXTENSION_TYPES).map((ext) => `.${ext}`),
].join(',');

/** Lower-cased type with its parameters (`; charset=utf-8`) removed. */
function normalizeMimeType(type: string): string {
  return (type.split(';')[0] ?? '').trim().toLowerCase();
}

/** True when an attachment may carry this MIME type. */
export function isAcceptedAttachmentType(type: string): boolean {
  const mime = normalizeMimeType(type);
  if (!mime) return false;
  return ATTACHMENT_ACCEPTED_TYPES.some((accepted) => {
    const isPrefix = accepted.endsWith('/') || accepted.endsWith('.');
    return isPrefix ? mime.startsWith(accepted) : mime === accepted;
  });
}

/**
 * The MIME type to store a file under, or null when it can't be attached.
 * The declared type wins when it is accepted; otherwise the file extension
 * decides. Either way the result is a type on the list above.
 */
export function resolveAttachmentType(name: string, type: string): string | null {
  if (isAcceptedAttachmentType(type)) return normalizeMimeType(type);
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  return ATTACHMENT_EXTENSION_TYPES[ext] ?? null;
}

/**
 * A file name safe to store and to echo in a `Content-Disposition` header:
 * no control characters or path separators, never empty, capped in length.
 */
export function sanitizeAttachmentFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
  const cleaned = name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (cleaned || 'attachment').slice(0, ATTACHMENT_FILENAME_MAX_LEN);
}

export function attachmentUrl(id: number): string {
  return `${ATTACHMENT_URL_PREFIX}${id}`;
}

/** The attachment id an href points at, or null when it is not an attachment URL. */
export function parseAttachmentUrl(href: string): number | null {
  const match = /^\/api\/attachments\/(\d{1,12})$/.exec(href.trim());
  return match?.[1] === undefined ? null : Number(match[1]);
}

export type AttachmentPreviewKind = 'image' | 'pdf' | 'audio' | 'video' | 'text' | 'none';

/** How the preview dialog can show a file of this type inline, if at all. */
export function attachmentPreviewKind(type: string): AttachmentPreviewKind {
  const mime = normalizeMimeType(type);
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'text/plain') return 'text';
  return 'none';
}

/**
 * Types a browser may render when it navigates to the attachment URL. Every
 * other type is served as a download. SVG is excluded: it is an image in an
 * `<img>` but a scriptable document when opened directly.
 */
export function attachmentServesInline(type: string): boolean {
  const mime = normalizeMimeType(type);
  if (mime === 'image/svg+xml') return false;
  return attachmentPreviewKind(mime) !== 'none';
}

// ---------------------------------------------------------------------------
// File chips inside description HTML
// ---------------------------------------------------------------------------

/** A file chip as it appears in description HTML. */
export interface FileChip {
  href: string;
  name: string;
  type: string;
}

/** What to do with a chip's href: a new value, `null` to remove it, `undefined` to leave it. */
export type FileChipRewrite = string | null | undefined;

const CHIP_TAG = /<a\b[^>]*\bdata-file-chip\b[^>]*>/gi;
const TAG_ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

interface TagAttribute {
  value: string;
  /** Offsets into the tag: the attribute with its leading whitespace, and the value alone. */
  attrStart: number;
  attrEnd: number;
  valueStart: number;
  valueEnd: number;
}

function parseTagAttributes(tag: string): Map<string, TagAttribute> {
  const attrs = new Map<string, TagAttribute>();
  for (const match of tag.matchAll(TAG_ATTRIBUTE)) {
    const [whole, name, doubleQuoted, singleQuoted] = match;
    const value = doubleQuoted ?? singleQuoted ?? '';
    const quote = doubleQuoted === undefined ? "'" : '"';
    const start = match.index;
    let attrStart = start;
    while (attrStart > 0 && /\s/.test(tag[attrStart - 1] ?? '')) attrStart--;
    const valueStart = start + whole.indexOf(quote) + 1;
    attrs.set((name ?? '').toLowerCase(), {
      value,
      attrStart,
      attrEnd: start + whole.length,
      valueStart,
      valueEnd: valueStart + value.length,
    });
  }
  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Visit every file chip in `html` and rewrite its href as `rewrite` decides.
 * Only the href changes; the rest of the markup is passed through untouched.
 */
export async function rewriteFileChips(
  html: string,
  rewrite: (chip: FileChip) => FileChipRewrite | Promise<FileChipRewrite>,
): Promise<string> {
  let out = '';
  let last = 0;
  for (const match of html.matchAll(CHIP_TAG)) {
    const tag = match[0];
    const at = match.index;
    const attrs = parseTagAttributes(tag);
    const href = attrs.get('href');
    const next = await rewrite({
      href: decodeEntities(href?.value ?? ''),
      name: decodeEntities(attrs.get('data-file-name')?.value ?? ''),
      type: decodeEntities(attrs.get('data-file-type')?.value ?? ''),
    });
    let newTag = tag;
    if (next === null) {
      if (href) newTag = tag.slice(0, href.attrStart) + tag.slice(href.attrEnd);
    } else if (typeof next === 'string') {
      newTag = href
        ? tag.slice(0, href.valueStart) + escapeAttribute(next) + tag.slice(href.valueEnd)
        : tag.replace(/^<a\b/i, `<a href="${escapeAttribute(next)}"`);
    }
    out += html.slice(last, at) + newTag;
    last = at + tag.length;
  }
  return out + html.slice(last);
}

/** The file chips in `html`, in document order. */
export function listFileChips(html: string): FileChip[] {
  const chips: FileChip[] = [];
  for (const match of html.matchAll(CHIP_TAG)) {
    const attrs = parseTagAttributes(match[0]);
    chips.push({
      href: decodeEntities(attrs.get('href')?.value ?? ''),
      name: decodeEntities(attrs.get('data-file-name')?.value ?? ''),
      type: decodeEntities(attrs.get('data-file-type')?.value ?? ''),
    });
  }
  return chips;
}

/** True when a chip still carries its file inline as a `data:` URL. */
export function hasInlineFileChip(html: string): boolean {
  return listFileChips(html).some((chip) => chip.href.toLowerCase().startsWith('data:'));
}

/** The type and base64 payload of a `data:` URL, or null for anything else. */
export function parseBase64DataUrl(href: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]*)$/i.exec(href.trim());
  if (!match) return null;
  return { mimeType: normalizeMimeType(match[1] ?? ''), base64: match[2] ?? '' };
}
