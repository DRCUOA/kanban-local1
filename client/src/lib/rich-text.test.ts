// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  sanitizeRichText,
  looksLikeRichText,
  plainTextToRichHtml,
  toRichHtml,
  richTextToPlainText,
  isRichTextEmpty,
  isAcceptedFileChipType,
  resolveFileChipType,
  attachmentFitsDescription,
  dataUrlToBlob,
  FILE_CHIP_ACCEPT,
  DESCRIPTION_MAX_CHARS,
} from './rich-text';

describe('looksLikeRichText', () => {
  it('detects HTML content', () => {
    expect(looksLikeRichText('<p>hello</p>')).toBe(true);
    expect(looksLikeRichText('plain text')).toBe(false);
    expect(looksLikeRichText('a < b and b > c')).toBe(false);
  });
});

describe('plainTextToRichHtml', () => {
  it('wraps paragraphs and keeps single newlines as line breaks', () => {
    expect(plainTextToRichHtml('line one\nline two\n\npara two')).toBe(
      '<p>line one<br>line two</p>\n<p>para two</p>',
    );
  });

  it('escapes HTML in legacy plain text', () => {
    expect(plainTextToRichHtml('a <script> tag')).toBe('<p>a &lt;script&gt; tag</p>');
  });

  it('renders Markdown written outside the editor', () => {
    expect(plainTextToRichHtml('## Plan\n\n- **ship** it')).toBe(
      '<h2>Plan</h2>\n<ul>\n<li><strong>ship</strong> it</li>\n</ul>',
    );
  });
});

describe('sanitizeRichText', () => {
  it('keeps allowed formatting', () => {
    const html = '<p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li>x</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('strips scripts and event handlers', () => {
    expect(sanitizeRichText('<p onclick="alert(1)">x<script>alert(1)</script></p>')).toBe(
      '<p>x</p>',
    );
  });

  it('removes javascript: hrefs but keeps https links with safe rel/target', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">bad</a>');
    expect(out).not.toContain('javascript:');
    const good = sanitizeRichText('<a href="https://example.com">ok</a>');
    expect(good).toContain('href="https://example.com"');
    expect(good).toContain('target="_blank"');
    expect(good).toContain('noopener');
  });

  it('keeps image data URLs on file chips but strips other data URLs', () => {
    const chip =
      '<a data-file-chip data-file-name="pic.png" href="data:image/png;base64,AAAA">pic.png</a>';
    expect(sanitizeRichText(chip)).toContain('href="data:image/png;base64,AAAA"');

    const evil = '<a data-file-chip data-file-name="x" href="data:text/html,<script>">x</a>';
    expect(sanitizeRichText(evil)).not.toContain('href');
  });

  it('strips data: hrefs on regular links', () => {
    expect(sanitizeRichText('<a href="data:image/png;base64,AAAA">x</a>')).not.toContain('href');
    const pdf = '<a href="data:application/pdf;base64,AAAA">x</a>';
    expect(sanitizeRichText(pdf)).not.toContain('href');
  });

  it('keeps data URLs of accepted document types on file chips', () => {
    for (const type of [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'audio/mpeg',
      'video/mp4',
    ]) {
      const chip = `<a data-file-chip data-file-name="f" href="data:${type};base64,AAAA">f</a>`;
      expect(sanitizeRichText(chip)).toContain(`href="data:${type};base64,AAAA"`);
    }
  });

  it('strips data URLs a browser would run, even on file chips', () => {
    for (const type of [
      'text/html',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
      'application/octet-stream',
      'application/pdfx',
    ]) {
      const chip = `<a data-file-chip data-file-name="f" href="data:${type};base64,AAAA">f</a>`;
      expect(sanitizeRichText(chip)).not.toContain('href');
    }
  });
});

describe('isAcceptedFileChipType', () => {
  it('matches prefixes and exact types, case-insensitively', () => {
    expect(isAcceptedFileChipType('image/png')).toBe(true);
    expect(isAcceptedFileChipType('Application/PDF')).toBe(true);
    expect(
      isAcceptedFileChipType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
    expect(isAcceptedFileChipType('text/html')).toBe(false);
    expect(isAcceptedFileChipType('text/plainx')).toBe(false);
    expect(isAcceptedFileChipType('')).toBe(false);
  });
});

describe('resolveFileChipType', () => {
  it("keeps the browser's type when it is accepted", () => {
    expect(resolveFileChipType('report.pdf', 'application/pdf')).toBe('application/pdf');
    expect(resolveFileChipType('shot.png', 'image/png')).toBe('image/png');
  });

  it('falls back to the extension for missing, generic or vendor types', () => {
    expect(resolveFileChipType('notes.md', '')).toBe('text/markdown');
    expect(resolveFileChipType('data.CSV', 'application/octet-stream')).toBe('text/csv');
    expect(resolveFileChipType('plan.pages', 'application/x-iwork-pages-sffpages')).toBe(
      'application/vnd.apple.pages',
    );
  });

  it('rejects files it cannot type as an accepted kind', () => {
    expect(resolveFileChipType('page.html', 'text/html')).toBeNull();
    expect(resolveFileChipType('run.exe', 'application/x-msdownload')).toBeNull();
    expect(resolveFileChipType('README', '')).toBeNull();
  });
});

describe('FILE_CHIP_ACCEPT', () => {
  it('lists wildcard families, exact types and fallback extensions', () => {
    const accept = FILE_CHIP_ACCEPT.split(',');
    expect(accept).toContain('image/*');
    expect(accept).toContain('application/pdf');
    expect(accept).toContain('.docx');
    expect(accept).toContain('.md');
    expect(accept.some((a) => a.endsWith('.'))).toBe(false);
  });
});

describe('toRichHtml', () => {
  it('passes rich HTML through sanitized and wraps plain text', () => {
    expect(toRichHtml('<p>hi</p>')).toBe('<p>hi</p>');
    expect(toRichHtml('hi\nthere')).toBe('<p>hi<br>there</p>');
    expect(toRichHtml(null)).toBe('');
  });

  it('renders Markdown and keeps the result within the allowed tags', () => {
    expect(toRichHtml('# Title\n\n~~old~~ [link](https://example.com)')).toBe(
      '<h1>Title</h1>\n<p><del>old</del> <a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">link</a></p>',
    );
  });
});

describe('richTextToPlainText', () => {
  it('flattens markup to text with line breaks', () => {
    expect(richTextToPlainText('<p>one</p><p>two<br>three</p>')).toBe('one\ntwo\nthree');
  });

  it('returns legacy plain text unchanged', () => {
    expect(richTextToPlainText('just text')).toBe('just text');
  });

  it('strips Markdown syntax so text previews read cleanly', () => {
    expect(richTextToPlainText('# Plan\n\n- **ship** it')).toBe('Plan\n\nship it');
  });

  it('replaces file chips with their name', () => {
    const html =
      '<p>see <a data-file-chip data-file-name="shot.png" href="data:image/png;base64,AAAA">shot.png</a></p>';
    expect(richTextToPlainText(html)).toBe('see [shot.png]');
  });
});

describe('isRichTextEmpty', () => {
  it('treats empty paragraphs as empty', () => {
    expect(isRichTextEmpty('<p></p>')).toBe(true);
    expect(isRichTextEmpty('')).toBe(true);
    expect(isRichTextEmpty(null)).toBe(true);
    expect(isRichTextEmpty('<p>x</p>')).toBe(false);
  });

  it('counts a lone file chip as content', () => {
    expect(
      isRichTextEmpty(
        '<p><a data-file-chip data-file-name="a.png" href="data:image/png;base64,AAAA"></a></p>',
      ),
    ).toBe(false);
  });
});

describe('attachmentFitsDescription', () => {
  it('counts the file at its base64 size against the description budget', () => {
    expect(attachmentFitsDescription(0, 3)).toBe(true);
    // 3 bytes become 4 characters: exactly at the limit still fits.
    expect(attachmentFitsDescription(DESCRIPTION_MAX_CHARS - 4, 3)).toBe(true);
    expect(attachmentFitsDescription(DESCRIPTION_MAX_CHARS - 3, 3)).toBe(false);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes base64 data URLs to the original bytes and type', async () => {
    const blob = dataUrlToBlob('data:application/pdf;base64,JVBERi0=');
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('%PDF-');
  });

  it('decodes percent-encoded data URLs', async () => {
    const blob = dataUrlToBlob('data:text/plain,hello%20world');
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('hello world');
  });

  it('round-trips binary bytes', async () => {
    const blob = dataUrlToBlob('data:application/zip;base64,AP+Afw==');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 255, 128, 127]);
  });

  it('rejects values that are not data URLs', () => {
    expect(() => dataUrlToBlob('https://example.com/a.pdf')).toThrow();
    expect(() => dataUrlToBlob('data:text/plain')).toThrow();
  });
});
