import { Marked, type Tokens } from 'marked';

/**
 * Markdown → HTML for task descriptions.
 *
 * Descriptions that never went through the TipTap editor (imports, AI drafts,
 * notes pasted from other tools) are usually written in Markdown. Rendering
 * them as Markdown means the preview shows formatting instead of raw `**` and
 * `-` markers.
 *
 * The output is deliberately narrow — only tags the editor's schema and
 * `sanitizeRichText` understand — so converted text round-trips through the
 * editor unchanged.
 */

/** The editor only offers h1–h3, so deeper headings clamp instead of vanishing. */
const MAX_HEADING_LEVEL = 3;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const markdown = new Marked({ gfm: true, breaks: true, async: false });

markdown.use({
  tokenizer: {
    // Tables have no counterpart in the editor's schema. Flattening one to bare
    // cell text loses more than leaving the pipes exactly as the author wrote
    // them, so the table syntax is never recognised in the first place.
    table() {
      return undefined;
    },
  },
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const level = Math.min(depth, MAX_HEADING_LEVEL);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    // Inline images aren't part of the schema (attachments are file chips), so
    // keep the reference as a link rather than letting sanitization drop it.
    image({ href, title, text }: Tokens.Image) {
      const label = text.trim() === '' ? (title ?? href) : text;
      return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    },
    checkbox({ checked }: Tokens.Checkbox) {
      return checked ? '☑ ' : '☐ ';
    },
    // Raw HTML in a description is text the author typed, not markup to run.
    // Escaping it here keeps it visible; sanitization would delete it.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
  },
});

/** Patterns that make a block of text worth parsing as Markdown. */
const MARKDOWN_PATTERNS = [
  /^ {0,3}#{1,6} /m, // heading
  /^ {0,3}[-*+] /m, // bullet list
  /^ {0,3}\d+[.)] /m, // ordered list
  /^ {0,3}> /m, // blockquote
  /^ {0,3}(?:```|~~~)/m, // fenced code
  /^ {0,3}([-*_])(?: *\1){2,} *$/m, // thematic break
  /\*\*\S(?:[\s\S]*?\S)?\*\*/, // bold
  /~~\S(?:[\s\S]*?\S)?~~/, // strikethrough
  /(?:^|\s)[*_]\S(?:[^*_\n]*\S)?[*_](?:\s|$)/, // emphasis
  /`[^`\n]+`/, // inline code
  /!?\[[^\]\n]*\]\([^()\s]+\)/, // link or image
];

/**
 * True when text carries Markdown syntax worth converting. Used to decide
 * whether pasted text should be interpreted rather than inserted verbatim —
 * conversion is a no-op for prose either way, but leaving plain paste alone
 * keeps the editor's own paste handling intact.
 */
export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

/** Render Markdown (or plain prose) as HTML. Still needs sanitizing. */
export function markdownToHtml(text: string): string {
  if (!text.trim()) return '';
  return markdown.parse(text, { async: false }).trim();
}
