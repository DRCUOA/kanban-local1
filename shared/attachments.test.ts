import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_ACCEPT,
  attachmentPreviewKind,
  attachmentServesInline,
  attachmentUrl,
  hasInlineFileChip,
  isAcceptedAttachmentType,
  listFileChips,
  parseAttachmentUrl,
  parseBase64DataUrl,
  resolveAttachmentType,
  rewriteFileChips,
  sanitizeAttachmentFilename,
} from './attachments';

describe('isAcceptedAttachmentType', () => {
  it('matches prefixes and exact types, ignoring case and parameters', () => {
    expect(isAcceptedAttachmentType('image/png')).toBe(true);
    expect(isAcceptedAttachmentType('Application/PDF')).toBe(true);
    expect(isAcceptedAttachmentType('text/plain; charset=utf-8')).toBe(true);
    expect(
      isAcceptedAttachmentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
  });

  it('refuses anything a browser would run, and unknown or empty types', () => {
    for (const type of [
      'text/html',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
      'application/octet-stream',
      'text/plainx',
      '',
    ]) {
      expect(isAcceptedAttachmentType(type)).toBe(false);
    }
  });
});

describe('resolveAttachmentType', () => {
  it('keeps the declared type when it is accepted', () => {
    expect(resolveAttachmentType('report.pdf', 'application/pdf')).toBe('application/pdf');
    expect(resolveAttachmentType('shot.png', 'image/PNG')).toBe('image/png');
  });

  it('falls back to the extension for missing, generic or vendor types', () => {
    expect(resolveAttachmentType('notes.md', '')).toBe('text/markdown');
    expect(resolveAttachmentType('data.CSV', 'application/octet-stream')).toBe('text/csv');
    expect(resolveAttachmentType('plan.pages', 'application/x-iwork-pages-sffpages')).toBe(
      'application/vnd.apple.pages',
    );
  });

  it('rejects files it cannot type as an accepted kind', () => {
    expect(resolveAttachmentType('page.html', 'text/html')).toBeNull();
    expect(resolveAttachmentType('run.exe', 'application/x-msdownload')).toBeNull();
    expect(resolveAttachmentType('README', '')).toBeNull();
  });
});

describe('sanitizeAttachmentFilename', () => {
  it('strips control characters and path separators and never returns empty', () => {
    expect(sanitizeAttachmentFilename('../etc/passwd')).toBe('.._etc_passwd');
    expect(sanitizeAttachmentFilename('a\u0000b\nc.txt')).toBe('a_b_c.txt');
    expect(sanitizeAttachmentFilename('   ')).toBe('attachment');
    expect(sanitizeAttachmentFilename('x'.repeat(300))).toHaveLength(255);
  });
});

describe('attachment urls', () => {
  it('round-trips an id', () => {
    expect(attachmentUrl(12)).toBe('/api/attachments/12');
    expect(parseAttachmentUrl('/api/attachments/12')).toBe(12);
  });

  it('rejects anything but a plain attachment path', () => {
    for (const href of [
      '/api/attachments/',
      '/api/attachments/12/x',
      '/api/attachments/12?download=1',
      'https://example.com/api/attachments/12',
      'data:image/png;base64,AAAA',
      '/api/attachments/-1',
    ]) {
      expect(parseAttachmentUrl(href)).toBeNull();
    }
  });
});

describe('preview and serving', () => {
  it('maps a type to how the preview shows it', () => {
    expect(attachmentPreviewKind('image/png')).toBe('image');
    expect(attachmentPreviewKind('application/pdf')).toBe('pdf');
    expect(attachmentPreviewKind('audio/mpeg')).toBe('audio');
    expect(attachmentPreviewKind('video/mp4')).toBe('video');
    expect(attachmentPreviewKind('text/plain; charset=utf-8')).toBe('text');
    expect(
      attachmentPreviewKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('none');
  });

  it('serves previewable types inline, except SVG', () => {
    expect(attachmentServesInline('image/png')).toBe(true);
    expect(attachmentServesInline('application/pdf')).toBe(true);
    expect(attachmentServesInline('image/svg+xml')).toBe(false);
    expect(attachmentServesInline('application/zip')).toBe(false);
  });
});

describe('ATTACHMENT_ACCEPT', () => {
  it('lists wildcard families, exact types and fallback extensions', () => {
    const accept = ATTACHMENT_ACCEPT.split(',');
    expect(accept).toContain('image/*');
    expect(accept).toContain('application/pdf');
    expect(accept).toContain('.docx');
    expect(accept).toContain('.md');
    expect(accept.some((entry) => entry.endsWith('.'))).toBe(false);
  });
});

describe('file chips', () => {
  const chip = (href: string) =>
    `<a data-file-chip="" data-file-name="a &amp; b.png" data-file-type="image/png" href="${href}" class="file-chip">a &amp; b.png</a>`;

  it('lists chips with their attributes decoded', () => {
    const html = `<p>see ${chip('/api/attachments/3')} and <a href="https://x.y">link</a></p>`;
    expect(listFileChips(html)).toEqual([
      { href: '/api/attachments/3', name: 'a & b.png', type: 'image/png' },
    ]);
  });

  it('detects chips still carrying their file inline', () => {
    expect(hasInlineFileChip(chip('data:image/png;base64,AAAA'))).toBe(true);
    expect(hasInlineFileChip(chip('/api/attachments/3'))).toBe(false);
    expect(hasInlineFileChip('<a href="data:image/png;base64,AAAA">not a chip</a>')).toBe(false);
  });

  it('parses base64 data urls only', () => {
    expect(parseBase64DataUrl('data:image/png;base64,AAAA')).toEqual({
      mimeType: 'image/png',
      base64: 'AAAA',
    });
    expect(parseBase64DataUrl('data:text/plain,hello')).toBeNull();
    expect(parseBase64DataUrl('/api/attachments/1')).toBeNull();
  });

  describe('rewriteFileChips', () => {
    it('replaces, removes or keeps each chip href and leaves the rest alone', async () => {
      const html = `<p>x ${chip('data:image/png;base64,AAAA')} y ${chip('/api/attachments/5')} z ${chip('/api/attachments/6')}</p>`;
      const out = await rewriteFileChips(html, (c) => {
        if (c.href.startsWith('data:')) return '/api/attachments/9';
        if (c.href.endsWith('/5')) return null;
        return undefined;
      });
      const withoutHref = chip('/api/attachments/5').replace(' href="/api/attachments/5"', '');
      expect(out).toBe(
        `<p>x ${chip('/api/attachments/9')} y ${withoutHref} z ${chip('/api/attachments/6')}</p>`,
      );
    });

    it('adds an href to a chip that has none, escaping the value', async () => {
      const out = await rewriteFileChips(
        '<a data-file-chip="" data-file-name="f">f</a>',
        () => '/api/attachments/1?a=1&b="2"',
      );
      expect(out).toBe(
        '<a href="/api/attachments/1?a=1&amp;b=&quot;2&quot;" data-file-chip="" data-file-name="f">f</a>',
      );
    });

    it('reads single-quoted attributes and awaits async rewrites', async () => {
      const out = await rewriteFileChips(
        "<a data-file-chip='' href='/api/attachments/2'>f</a>",
        (c) => Promise.resolve(`${c.href}0`),
      );
      expect(out).toBe("<a data-file-chip='' href='/api/attachments/20'>f</a>");
    });
  });
});
