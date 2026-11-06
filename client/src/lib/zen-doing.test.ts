// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Stage } from '@shared/schema';
import { appendZenDoneLine, zenDoneLine, zenDoneStage } from './zen-doing';

// Friday 6 November 2026, 3:42 pm local time.
const FRIDAY = new Date(2026, 10, 6, 15, 42);

const stage = (id: number, kind: string, order: number, name = kind): Stage =>
  ({ id, name, kind, order }) as unknown as Stage;

describe('zenDoneStage', () => {
  it('is the first Done column in board order', () => {
    const stages = [
      stage(9, 'done', 7, 'Shipped'),
      stage(1, 'backlog', 1),
      stage(3, 'done', 5, 'Done  ✔'),
      stage(4, 'abandoned', 6),
    ];
    expect(zenDoneStage(stages)?.id).toBe(3);
  });

  it('is null on a board with no Done column, abandoned included', () => {
    expect(zenDoneStage([stage(1, 'backlog', 1), stage(4, 'abandoned', 2)])).toBeNull();
  });
});

describe('zenDoneLine', () => {
  it('stamps the date and time, then says it in Rich’s words', () => {
    expect(zenDoneLine(FRIDAY)).toBe(
      'Nov 6, 2026 3:42 PM: marked done via Zen doing mode on Friday the 11-26, go you!',
    );
  });
});

describe('appendZenDoneLine', () => {
  const line =
    '<p><strong>Nov 6, 2026 3:42 PM</strong>: marked done via Zen doing mode on Friday the 11-26, go you!</p>';

  it('adds the line as the last paragraph of a rich-text description', () => {
    expect(appendZenDoneLine('<ol><li>Sweep</li></ol><p>Done when swept.</p>', FRIDAY)).toBe(
      `<ol><li>Sweep</li></ol><p>Done when swept.</p>${line}`,
    );
  });

  it('converts a plain-text description first, as the editor would', () => {
    expect(appendZenDoneLine('Water the plants', FRIDAY)).toBe(`<p>Water the plants</p>${line}`);
  });

  it('is the line alone when there was no description', () => {
    expect(appendZenDoneLine('', FRIDAY)).toBe(line);
    expect(appendZenDoneLine(null, FRIDAY)).toBe(line);
  });
});
