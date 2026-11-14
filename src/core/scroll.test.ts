import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_ANCHOR,
  anchoredScroll,
  contentHeight,
  reachedExtreme,
  scrollRange,
  scrollToReveal,
  snapScroll,
  type ColumnMetrics,
} from './scroll';

/** Stacks items of the given heights in a column of the given visible height. */
function column(height: number, itemHeights: readonly number[]): ColumnMetrics {
  let top = 0;
  const items = itemHeights.map((itemHeight) => {
    const box = { top, height: itemHeight };
    top += itemHeight;
    return box;
  });
  return { height, items };
}

// Visible height 200, content 600: first item 40 tall, last item 80 tall.
const tall = column(200, [40, 100, 100, 100, 100, 80, 80]);
const range = scrollRange(tall);

describe('scrollRange', () => {
  it('uses half the first and half the last item, which may differ', () => {
    expect(contentHeight(tall)).toBe(600);
    expect(range).toEqual({ top: 20, bottom: 160, max: 400 });
  });

  it('has no scroll when the content fits', () => {
    expect(scrollRange(column(200, [50, 50])).max).toBe(0);
  });

  it('ignores an overflow of a fraction of a pixel', () => {
    // Fractional sizes: the items add up to 200.4 in a column measured as 200.
    expect(scrollRange(column(200, [100.2, 100.2])).max).toBe(0);
    expect(scrollRange(column(200, [100.5, 100.5])).max).toBe(1);
  });

  it('copes with an empty column', () => {
    expect(scrollRange(column(200, []))).toEqual({ top: 0, bottom: 200, max: 0 });
  });
});

describe('anchoredScroll', () => {
  it('is always 0 when the content fits', () => {
    const fits = scrollRange(column(200, [50, 50]));
    expect(anchoredScroll(150, fits, { y: 10, scroll: 0 })).toBe(0);
  });

  it('keeps the offset of the column at the anchor: nothing jumps', () => {
    expect(anchoredScroll(120, range, { y: 120, scroll: 0 })).toBe(0);
    expect(anchoredScroll(120, range, { y: 120, scroll: 250 })).toBe(250);
  });

  it('reaches 0 at the top and the maximum at the bottom', () => {
    const anchor = { y: 90, scroll: 250 };
    expect(anchoredScroll(20, range, anchor)).toBe(0);
    expect(anchoredScroll(160, range, anchor)).toBe(400);
  });

  it('centres the first and the last item under the pointer at the extremes', () => {
    const anchor = { y: 90, scroll: 250 };
    // Content position under the pointer = pointer height + scroll offset.
    expect(20 + anchoredScroll(20, range, anchor)).toBe(20); // middle of the first item
    expect(160 + anchoredScroll(160, range, anchor)).toBe(560); // middle of the last item
  });

  it('interpolates linearly on each side of the anchor', () => {
    const anchor = { y: 90, scroll: 100 };
    expect(anchoredScroll(55, range, anchor)).toBe(50); // halfway up to the top
    expect(anchoredScroll(125, range, anchor)).toBe(250); // halfway down to the bottom
  });

  it('never moves the content backwards as the pointer moves down', () => {
    const anchor = { y: 70, scroll: 300 };
    let previous = -1;
    for (let y = 0; y <= 200; y += 5) {
      const position = y + anchoredScroll(y, range, anchor);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
  });

  it('clamps the pointer beyond the extremes', () => {
    const anchor = { y: 90, scroll: 250 };
    expect(anchoredScroll(-50, range, anchor)).toBe(0);
    expect(anchoredScroll(500, range, anchor)).toBe(400);
  });

  it('does not jump when the press is beyond an extreme of a scrolled column', () => {
    // Pressed in the top half of the first visible item, with the column scrolled.
    const anchor = { y: 5, scroll: 250 };
    expect(anchoredScroll(5, range, anchor)).toBe(250);
    // Moving further up goes to the first item; moving down scrolls on.
    expect(anchoredScroll(2, range, anchor)).toBe(0);
    expect(anchoredScroll(90, range, anchor)).toBe(325);
  });

  it('keeps the offset in a column too short to interpolate', () => {
    const tiny = scrollRange(column(30, [40, 40]));
    expect(tiny.bottom).toBeLessThan(tiny.top);
    expect(anchoredScroll(10, tiny, { y: 10, scroll: 20 })).toBe(20);
  });
});

describe('reachedExtreme and ABSOLUTE_ANCHOR', () => {
  it('is reached by moving to the first or last item, away from the anchor', () => {
    const anchor = { y: 90, scroll: 250 };
    expect(reachedExtreme(20, range, anchor)).toBe(true);
    expect(reachedExtreme(10, range, anchor)).toBe(true);
    expect(reachedExtreme(160, range, anchor)).toBe(true);
    expect(reachedExtreme(21, range, anchor)).toBe(false);
    expect(reachedExtreme(159, range, anchor)).toBe(false);
  });

  it('is not reached by moving back from an anchor beyond the extreme', () => {
    expect(reachedExtreme(12, range, { y: 5, scroll: 250 })).toBe(false);
    expect(reachedExtreme(3, range, { y: 5, scroll: 250 })).toBe(true);
  });

  it('is never reached when the column does not overflow', () => {
    const fits = scrollRange(column(200, [50, 50]));
    expect(reachedExtreme(0, fits, { y: 90, scroll: 0 })).toBe(false);
  });

  it('switches without a jump: the anchored offset is already 0 or max there', () => {
    const anchor = { y: 90, scroll: 250 };
    expect(anchoredScroll(20, range, anchor)).toBe(
      anchoredScroll(20, range, ABSOLUTE_ANCHOR),
    );
    expect(anchoredScroll(160, range, anchor)).toBe(
      anchoredScroll(160, range, ABSOLUTE_ANCHOR),
    );
  });

  it('makes the anchored scroll the plain linear mapping', () => {
    for (const y of [0, 20, 55, 90, 125, 160, 200]) {
      const plain = (400 * (Math.min(Math.max(y, 20), 160) - 20)) / (160 - 20);
      expect(anchoredScroll(y, range, ABSOLUTE_ANCHOR)).toBeCloseTo(plain);
    }
  });
});

describe('snapScroll', () => {
  it('rounds to whole pixels and stays within the range', () => {
    expect(snapScroll(12.4, 100)).toBe(12);
    expect(snapScroll(12.6, 100)).toBe(13);
    expect(snapScroll(-3, 100)).toBe(0);
    expect(snapScroll(99.8, 99.6)).toBe(99.6);
    expect(snapScroll(5, 0)).toBe(0);
  });
});

describe('scrollToReveal', () => {
  it('keeps the offset when the item is already visible', () => {
    expect(scrollToReveal(100, { top: 140, height: 100 }, tall)).toBe(100);
  });

  it('scrolls down just enough for an item below', () => {
    expect(scrollToReveal(0, { top: 440, height: 80 }, tall)).toBe(320);
  });

  it('scrolls up just enough for an item above', () => {
    expect(scrollToReveal(400, { top: 40, height: 100 }, tall)).toBe(40);
  });
});
