// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { ClientRect, CollisionDetection } from '@dnd-kit/core';
import { clipRect, overflowAncestors, withClippedDroppableRects } from './clip-droppable-rects';

type CollisionArgs = Parameters<CollisionDetection>[0];

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function box(
  left: number,
  top: number,
  width: number,
  height: number,
  overflowY = '',
): HTMLElement {
  const element = document.createElement('div');
  if (overflowY) element.style.overflowY = overflowY;
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  return element;
}

describe('overflowAncestors', () => {
  it('lists only ancestors that clip, nearest first, stopping at body', () => {
    const outer = box(0, 0, 500, 500, 'auto');
    const middle = box(0, 0, 500, 500); // overflow visible — not a clipper
    const inner = box(0, 0, 500, 500, 'hidden');
    const leaf = box(0, 0, 10, 10);
    document.body.append(outer);
    outer.append(middle);
    middle.append(inner);
    inner.append(leaf);
    try {
      expect(overflowAncestors(leaf)).toEqual([inner, outer]);
    } finally {
      outer.remove();
    }
  });
});

describe('clipRect', () => {
  it('returns the rect untouched with no clipping ancestors', () => {
    expect(clipRect(rect(10, 10, 100, 100), [])).toEqual(rect(10, 10, 100, 100));
  });

  it('cuts a lane that overhangs its scrolling column down to the visible part', () => {
    // Column body shows y 100…300; the lane inside is laid out y 150…600.
    const column = box(0, 100, 300, 200, 'auto');
    expect(clipRect(rect(10, 150, 280, 450), [column])).toEqual(rect(10, 150, 280, 150));
  });

  it('drops a rect that is scrolled entirely out of view', () => {
    const column = box(0, 100, 300, 200, 'auto');
    expect(clipRect(rect(10, 400, 280, 100), [column])).toBeNull();
  });

  it('ignores an ancestor with no box yet', () => {
    const unlaidOut = box(0, 0, 0, 0, 'auto');
    expect(clipRect(rect(10, 10, 100, 100), [unlaidOut])).toEqual(rect(10, 10, 100, 100));
  });
});

describe('withClippedDroppableRects', () => {
  it('replaces every droppable rect with its visible part and forgets invisible ones', () => {
    const column = box(0, 100, 300, 200, 'auto');
    const laneNode = box(10, 150, 280, 450);
    const stripNode = box(0, 320, 1000, 100);
    const hiddenNode = box(10, 400, 280, 100);
    document.body.append(column);
    column.append(laneNode, hiddenNode);
    document.body.append(stripNode);

    const container = (id: string, node: Element) =>
      ({ id, node: { current: node } }) as unknown as CollisionArgs['droppableContainers'][number];
    const args = {
      droppableContainers: [
        container('lane', laneNode),
        container('strip', stripNode),
        container('hidden', hiddenNode),
      ],
      droppableRects: new Map<string, ClientRect>([
        ['lane', rect(10, 150, 280, 450)],
        ['strip', rect(0, 320, 1000, 100)],
        ['hidden', rect(10, 400, 280, 100)],
      ]),
      pointerCoordinates: { x: 100, y: 350 },
    } as unknown as CollisionArgs;

    try {
      const clipped = withClippedDroppableRects(args, overflowAncestors);
      expect(clipped.droppableRects.get('lane')).toEqual(rect(10, 150, 280, 150));
      expect(clipped.droppableRects.get('strip')).toEqual(rect(0, 320, 1000, 100));
      expect(clipped.droppableRects.has('hidden')).toBe(false);
      // The original map is untouched.
      expect(args.droppableRects.get('lane')).toEqual(rect(10, 150, 280, 450));
    } finally {
      column.remove();
      stripNode.remove();
    }
  });
});
