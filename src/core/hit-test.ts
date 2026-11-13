import type { ColumnBox } from './layout';
import type { ItemBox } from './scroll';

/** Whether `x` falls inside a visible column. */
export function isInside(x: number, box: ColumnBox | undefined): boolean {
  return box !== undefined && box.width > 0 && x >= box.x && x < box.x + box.width;
}

/**
 * Index of the visible column under `x`.
 *
 * To the right of the last visible column the pointer counts as inside it, and
 * likewise to the left of the first. Returns -1 when no column is visible.
 */
export function columnUnder(x: number, boxes: readonly ColumnBox[]): number {
  let last = -1;
  for (const [index, box] of boxes.entries()) {
    if (box.width <= 0) continue;
    if (x < box.x + box.width) return index;
    last = index;
  }
  return last;
}

/** Index of the item under `contentY`, or `null` over an empty area. */
export function itemUnder(contentY: number, items: readonly ItemBox[]): number | null {
  for (const [index, item] of items.entries()) {
    if (contentY >= item.top && contentY < item.top + item.height) return index;
  }
  return null;
}
