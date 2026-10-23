import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_COLOR } from './AppLogo';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').toLowerCase();

/**
 * The mark is drawn in four places: inline in the header (AppLogo), and in
 * the favicon and home-screen icon sources. A recolour that reaches some of
 * them and not the others is what this guards against.
 */
describe('the Kanbando mark', () => {
  it('is one colour in the header, the favicon and the home-screen icons', () => {
    const colour = MARK_COLOR.toLowerCase();
    expect(colour).toBe('#ff4500');
    expect(read('client/public/favicon.svg')).toContain(`fill: ${colour}`);
    expect(read('script/icons/mark-32.svg')).toContain(`color="${colour}"`);
    expect(read('script/icons/mark-16.svg')).toContain(`color="${colour}"`);
    expect(read('script/icons/mark-app-icon.svg')).toContain(`fill="${colour}"`);
  });
});
