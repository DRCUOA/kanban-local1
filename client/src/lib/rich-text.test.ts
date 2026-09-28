// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  sanitizeRichText,
  looksLikeRichText,
  plainTextToRichHtml,
  toRichHtml,
  richTextToPlainText,
  isRichTextEmpty,
  absolutizeAttachmentLinks,
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

  it('keeps attachment urls on file chips but strips any other chip href', () => {
    const chip = (href: string) =>
      `<a data-file-chip data-file-name="pic.png" href="${href}">pic.png</a>`;
    expect(sanitizeRichText(chip('/api/attachments/12'))).toContain('href="/api/attachments/12"');
    for (const href of [
      'data:image/png;base64,AAAA',
      'https://example.com/pic.png',
      '/api/attachments/12/../../x',
      'javascript:alert(1)',
    ]) {
      expect(sanitizeRichText(chip(href))).not.toContain('href');
    }
  });

  it('strips data: and attachment hrefs on regular links', () => {
    expect(sanitizeRichText('<a href="data:image/png;base64,AAAA">x</a>')).not.toContain('href');
    expect(sanitizeRichText('<a href="/api/attachments/12">x</a>')).not.toContain('href');
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
      '<p>see <a data-file-chip data-file-name="shot.png" href="/api/attachments/1">shot.png</a></p>';
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
        '<p><a data-file-chip data-file-name="a.png" href="/api/attachments/1"></a></p>',
      ),
    ).toBe(false);
  });
});

describe('absolutizeAttachmentLinks', () => {
  it('puts the origin in front of attachment links and leaves other links alone', () => {
    const html =
      '<p><a href="/api/attachments/3" data-file-chip="">f</a> <a href="https://x.y/">x</a></p>';
    expect(absolutizeAttachmentLinks(html, 'https://board.example/')).toBe(
      '<p><a href="https://board.example/api/attachments/3" data-file-chip="">f</a> <a href="https://x.y/">x</a></p>',
    );
    expect(absolutizeAttachmentLinks(html, '')).toBe(html);
  });
});
