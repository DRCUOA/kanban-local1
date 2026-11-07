import { describe, expect, it } from 'vitest';
import {
  POLISH_MAX_HTML,
  POLISH_SYSTEM_PROMPT,
  buildPolishInput,
  cleanPolishReply,
  hasVisibleText,
  polishRequestSchema,
  protectFileChips,
  restoreFileChips,
} from './description-polish';

const chip = (id: number, name: string) =>
  `<a data-file-chip="" data-file-name="${name}" data-file-type="application/pdf" href="/api/attachments/${id}" class="file-chip">${name}</a>`;

describe('protectFileChips / restoreFileChips', () => {
  it('swaps each chip for a numbered token and puts it back in the same place', () => {
    const html = `<p>Quote ${chip(12, 'quote.pdf')} and plan ${chip(13, 'plan.pdf')}</p>`;
    const protectedHtml = protectFileChips(html);
    expect(protectedHtml.html).toBe('<p>Quote [[file:1]] and plan [[file:2]]</p>');
    expect(protectedHtml.html).not.toContain('/api/attachments');
    expect(protectedHtml.chips).toHaveLength(2);

    const back = restoreFileChips(protectedHtml.html, protectedHtml.chips);
    expect(back).toEqual({ html, movedToEnd: 0 });
  });

  it('follows the tokens when the model moves them', () => {
    const { chips } = protectFileChips(`<p>${chip(1, 'a.pdf')} ${chip(2, 'b.pdf')}</p>`);
    const back = restoreFileChips('<ul><li>B [[file:2]]</li><li>A [[file:1]]</li></ul>', chips);
    expect(back.html).toBe(`<ul><li>B ${chip(2, 'b.pdf')}</li><li>A ${chip(1, 'a.pdf')}</li></ul>`);
    expect(back.movedToEnd).toBe(0);
  });

  it('puts a chip whose token went missing back at the end, so no attachment is lost', () => {
    const { chips } = protectFileChips(`<p>See ${chip(7, 'photo.jpg')}</p>`);
    const back = restoreFileChips('<p>See the photo.</p>', chips);
    expect(back.html).toBe(`<p>See the photo.</p><p>${chip(7, 'photo.jpg')}</p>`);
    expect(back.movedToEnd).toBe(1);
  });

  it('drops a repeated token and a token that is not ours', () => {
    const { chips } = protectFileChips(`<p>${chip(7, 'photo.jpg')}</p>`);
    const back = restoreFileChips('<p>[[file:1]] again [[file:1]] and [[file:9]]</p>', chips);
    expect(back.html).toBe(`<p>${chip(7, 'photo.jpg')} again  and </p>`);
    expect(back.movedToEnd).toBe(0);
  });

  it('leaves a description without attachments as it is', () => {
    expect(protectFileChips('<p>Plain</p>')).toEqual({ html: '<p>Plain</p>', chips: [] });
    expect(restoreFileChips('<p>Plain</p>', [])).toEqual({ html: '<p>Plain</p>', movedToEnd: 0 });
  });
});

describe('cleanPolishReply', () => {
  it('takes the HTML out of a code fence', () => {
    expect(cleanPolishReply('```html\n<p>Hi</p>\n```')).toBe('<p>Hi</p>');
    expect(cleanPolishReply('```\n<p>Hi</p>```')).toBe('<p>Hi</p>');
  });

  it('removes an echoed description wrapper', () => {
    expect(cleanPolishReply('<description>\n<p>Hi</p>\n</description>')).toBe('<p>Hi</p>');
  });

  it('leaves a clean reply alone', () => {
    expect(cleanPolishReply('  <p>Hi</p>\n')).toBe('<p>Hi</p>');
  });
});

describe('polishRequestSchema', () => {
  it('accepts a description with words and an instruction, trimming the instruction', () => {
    const parsed = polishRequestSchema.parse({ html: '<p>Fix it</p>', instruction: '  Shorten ' });
    expect(parsed.instruction).toBe('Shorten');
  });

  it('refuses an empty description, an attachment on its own and a blank instruction', () => {
    expect(polishRequestSchema.safeParse({ html: '<p></p>', instruction: 'x' }).success).toBe(
      false,
    );
    expect(
      polishRequestSchema.safeParse({ html: chip(1, 'a.pdf'), instruction: 'x' }).success,
    ).toBe(false);
    expect(polishRequestSchema.safeParse({ html: '<p>Hi</p>', instruction: '  ' }).success).toBe(
      false,
    );
  });

  it('refuses a description over the size limit', () => {
    const html = `<p>${'a'.repeat(POLISH_MAX_HTML)}</p>`;
    expect(polishRequestSchema.safeParse({ html, instruction: 'x' }).success).toBe(false);
  });

  it('counts &nbsp; as space, not as words', () => {
    expect(hasVisibleText('<p>&nbsp;</p>')).toBe(false);
    expect(hasVisibleText('<p>&nbsp;ok</p>')).toBe(true);
  });
});

describe('the prompt', () => {
  it('tells the model to keep the file tokens and not to invent facts', () => {
    expect(POLISH_SYSTEM_PROMPT).toMatch(/\[\[file:1\]\]/);
    expect(POLISH_SYSTEM_PROMPT).toMatch(/Do not add facts/);
  });

  it('wraps the instruction and the description so one cannot pass for the other', () => {
    const input = buildPolishInput(' Shorten ', '<p>Long text</p>');
    expect(input).toBe(
      '<instruction>\nShorten\n</instruction>\n\n<description>\n<p>Long text</p>\n</description>',
    );
  });
});
