import { describe, it, expect } from 'vitest';
import { markdownToHtml, looksLikeMarkdown } from './markdown';

describe('markdownToHtml', () => {
  it('renders inline formatting', () => {
    expect(markdownToHtml('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>',
    );
    expect(markdownToHtml('~~gone~~')).toBe('<p><del>gone</del></p>');
  });

  it('renders lists, quotes and rules', () => {
    expect(markdownToHtml('- one\n- two')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(markdownToHtml('1. one\n2. two')).toBe('<ol>\n<li>one</li>\n<li>two</li>\n</ol>');
    expect(markdownToHtml('> quoted')).toBe('<blockquote>\n<p>quoted</p>\n</blockquote>');
    expect(markdownToHtml('---')).toBe('<hr>');
  });

  it('renders task list checkboxes as symbols', () => {
    expect(markdownToHtml('- [ ] todo\n- [x] done')).toBe(
      '<ul>\n<li>☐ todo</li>\n<li>☑ done</li>\n</ul>',
    );
  });

  it('clamps headings to the levels the editor supports', () => {
    expect(markdownToHtml('# one')).toBe('<h1>one</h1>');
    expect(markdownToHtml('###### six')).toBe('<h3>six</h3>');
  });

  it('renders links and keeps images as links', () => {
    expect(markdownToHtml('[site](https://example.com)')).toBe(
      '<p><a href="https://example.com">site</a></p>',
    );
    expect(markdownToHtml('![shot](https://example.com/a.png)')).toBe(
      '<p><a href="https://example.com/a.png">shot</a></p>',
    );
  });

  it('escapes raw HTML instead of emitting it', () => {
    expect(markdownToHtml('a <script>alert(1)</script> tag')).toBe(
      '<p>a &lt;script&gt;alert(1)&lt;/script&gt; tag</p>',
    );
  });

  it('keeps code blocks verbatim', () => {
    expect(markdownToHtml('```js\nif (a < b) go();\n```')).toBe(
      '<pre><code class="language-js">if (a &lt; b) go();\n</code></pre>',
    );
  });

  it('leaves tables as written rather than flattening them', () => {
    expect(markdownToHtml('| a | b |\n| - | - |\n| 1 | 2 |')).toBe(
      '<p>| a | b |<br>| - | - |<br>| 1 | 2 |</p>',
    );
  });

  it('treats single newlines as line breaks and blank lines as paragraphs', () => {
    expect(markdownToHtml('line one\nline two\n\npara two')).toBe(
      '<p>line one<br>line two</p>\n<p>para two</p>',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml('   \n  ')).toBe('');
  });
});

describe('looksLikeMarkdown', () => {
  it('detects block and inline syntax', () => {
    expect(looksLikeMarkdown('# Heading')).toBe(true);
    expect(looksLikeMarkdown('- item')).toBe(true);
    expect(looksLikeMarkdown('1. item')).toBe(true);
    expect(looksLikeMarkdown('> quote')).toBe(true);
    expect(looksLikeMarkdown('```\ncode\n```')).toBe(true);
    expect(looksLikeMarkdown('---')).toBe(true);
    expect(looksLikeMarkdown('some **bold** text')).toBe(true);
    expect(looksLikeMarkdown('some ~~struck~~ text')).toBe(true);
    expect(looksLikeMarkdown('some `code` text')).toBe(true);
    expect(looksLikeMarkdown('a [link](https://example.com)')).toBe(true);
  });

  it('leaves ordinary prose alone', () => {
    expect(looksLikeMarkdown('Call the vendor about the invoice')).toBe(false);
    expect(looksLikeMarkdown('Costs 2 * 3 dollars')).toBe(false);
    expect(looksLikeMarkdown('see file_name_here.txt')).toBe(false);
    expect(looksLikeMarkdown('')).toBe(false);
  });
});
