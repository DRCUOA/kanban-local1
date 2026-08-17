import type { ClientRect, CollisionDetection } from '@dnd-kit/core';

/**
 * dnd-kit measures droppable rects unclipped: a sub-stage lane inside a
 * column body that scrolls (horizontal layout) reports its full laid-out
 * height, which can reach far below the part of the column that is visible.
 * Anything sitting under the columns — the done strip, the archive strip —
 * would then be shadowed by that invisible overhang for `pointerWithin`.
 *
 * These helpers clip every droppable rect to the rects of its overflow
 * (`auto` / `scroll` / `hidden` / `clip`) ancestors, so only area the user can
 * actually see can be hit. Rects that clip away entirely are dropped.
 */

type CollisionArgs = Parameters<CollisionDetection>[0];

const CLIPPING_OVERFLOW = /auto|scroll|hidden|clip/;

function clipsOverflow(element: Element): boolean {
  const style = getComputedStyle(element);
  return CLIPPING_OVERFLOW.test(`${style.overflowX} ${style.overflowY}`);
}

/** Ancestors of `element` (nearest first) whose overflow clips their content. */
export function overflowAncestors(element: Element): Element[] {
  const ancestors: Element[] = [];
  let current = element.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    if (clipsOverflow(current)) ancestors.push(current);
    current = current.parentElement;
  }
  return ancestors;
}

function intersect(a: ClientRect, b: DOMRect): ClientRect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * `rect` limited to what is visible through `ancestors`; `null` if nothing is.
 * An ancestor with no box yet (zero size, e.g. before first layout) does not
 * clip — a not-yet-laid-out box says nothing about visibility.
 */
export function clipRect(rect: ClientRect, ancestors: readonly Element[]): ClientRect | null {
  let clipped: ClientRect = rect;
  for (const ancestor of ancestors) {
    const bounds = ancestor.getBoundingClientRect();
    if (bounds.width === 0 && bounds.height === 0) continue;
    const next = intersect(clipped, bounds);
    if (!next) return null;
    clipped = next;
  }
  return clipped;
}

/**
 * Collision-detection args with every droppable rect clipped to its overflow
 * ancestors. `ancestorsOf` is memoised by the caller for the life of a drag,
 * because the DOM tree does not change while dragging but the rects do.
 */
export function withClippedDroppableRects(
  args: CollisionArgs,
  ancestorsOf: (element: Element) => readonly Element[],
): CollisionArgs {
  const droppableRects: CollisionArgs['droppableRects'] = new Map();
  for (const container of args.droppableContainers) {
    const rect = args.droppableRects.get(container.id);
    if (!rect) continue;
    const node = container.node.current;
    const visible = node ? clipRect(rect, ancestorsOf(node)) : rect;
    if (visible) droppableRects.set(container.id, visible);
  }
  return { ...args, droppableRects };
}
