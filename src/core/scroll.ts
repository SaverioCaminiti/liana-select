/**
 * Vertical scrolling driven by the pointer.
 *
 * There are no scrollbars: an overflowing column scrolls as a function of the
 * vertical position of the pointer, so that every item can be reached without
 * lifting it.
 */

/** Vertical geometry of a column, in pixels. */
export interface ColumnMetrics {
  /** Visible height of the column. */
  readonly height: number;
  /** Position and height of each item, relative to the top of the content. */
  readonly items: readonly ItemBox[];
}

export interface ItemBox {
  readonly top: number;
  readonly height: number;
}

export interface ScrollRange {
  /** Pointer height at which the scroll offset is 0: half the first item. */
  readonly top: number;
  /** Pointer height at which the offset is `max`: half the last item from the bottom. */
  readonly bottom: number;
  /** Maximum scroll offset; 0 when the content fits. */
  readonly max: number;
}

/** A pointer height and the scroll offset the column had there. */
export interface ScrollAnchor {
  readonly y: number;
  readonly scroll: number;
}

export function contentHeight(metrics: ColumnMetrics): number {
  const last = metrics.items.at(-1);
  return last === undefined ? 0 : last.top + last.height;
}

export function scrollRange(metrics: ColumnMetrics): ScrollRange {
  const first = metrics.items[0];
  const last = metrics.items.at(-1);
  return {
    top: first === undefined ? 0 : first.height / 2,
    bottom: metrics.height - (last === undefined ? 0 : last.height / 2),
    max: Math.max(0, contentHeight(metrics) - metrics.height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Scroll offset for a pointer at height `y`.
 *
 * The offset is 0 at `range.top` and `range.max` at `range.bottom`, so the first
 * and the last item end up centred under the pointer at the two extremes. In
 * between it is interpolated linearly through the anchor: where the pointer
 * pressed on the column or entered it, the column keeps the offset it had, so
 * nothing jumps under the pointer.
 */
export function anchoredScroll(
  y: number,
  range: ScrollRange,
  anchor: ScrollAnchor,
): number {
  const { top, bottom, max } = range;
  if (max <= 0) return 0;

  const anchorScroll = clamp(anchor.scroll, 0, max);
  // A column shorter than its first and last half items has no room to interpolate.
  if (bottom <= top) return anchorScroll;

  const pointerY = clamp(y, top, bottom);
  const anchorY = clamp(anchor.y, top, bottom);

  if (pointerY < anchorY) {
    return (anchorScroll * (pointerY - top)) / (anchorY - top);
  }
  if (pointerY > anchorY) {
    return (
      anchorScroll + ((max - anchorScroll) * (pointerY - anchorY)) / (bottom - anchorY)
    );
  }

  // The pointer is level with the anchor, or both are beyond the same extreme.
  // In the second case there is no room left to interpolate: moving further out
  // goes straight to the extreme, so the first and last item stay reachable.
  if (y < anchor.y && pointerY === top) return 0;
  if (y > anchor.y && pointerY === bottom) return max;
  return anchorScroll;
}

/**
 * The closest offset to `scroll` that shows the whole item, used to reveal the
 * selected item of a column that nobody is pointing at.
 */
export function scrollToReveal(
  scroll: number,
  item: ItemBox,
  metrics: ColumnMetrics,
): number {
  const max = scrollRange(metrics).max;
  const lowest = item.top + item.height - metrics.height;
  return clamp(clamp(scroll, lowest, item.top), 0, max);
}
