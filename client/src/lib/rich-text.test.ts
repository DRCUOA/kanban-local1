// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  sanitizeRichText,
  looksLikeRichText,
  plainTextToRichHtml,
  toRichHtml,
  richTextToPlainText,
  isRichTextEmpty,
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
      '<p>line one<br>line two</p><p>para two</p>',
    );
  });

  it('escapes HTML in legacy plain text', () => {
    expect(plainTextToRichHtml('a <script> tag')).toBe('<p>a &lt;script&gt; tag</p>');
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
  });
});

describe('toRichHtml', () => {
  it('passes rich HTML through sanitized and wraps plain text', () => {
    expect(toRichHtml('<p>hi</p>')).toBe('<p>hi</p>');
    expect(toRichHtml('hi\nthere')).toBe('<p>hi<br>there</p>');
    expect(toRichHtml(null)).toBe('');
  });
});

describe('richTextToPlainText', () => {
  it('flattens markup to text with line breaks', () => {
    expect(richTextToPlainText('<p>one</p><p>two<br>three</p>')).toBe('one\ntwo\nthree');
  });

  it('returns legacy plain text unchanged', () => {
    expect(richTextToPlainText('just text')).toBe('just text');
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
