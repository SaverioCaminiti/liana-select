import { describe, expect, it } from 'vitest';
import { layoutColumns, type ColumnBox, type LayoutInput } from './layout';

const base: LayoutInput = {
  width: 1000,
  depth: 4,
  columnCount: 1,
  current: 0,
  reservePreview: true,
  minContentWidth: 200,
  collapsedMinWidth: 40,
};

function widths(boxes: readonly ColumnBox[]): number[] {
  return boxes.map((box) => box.width);
}

describe('layoutColumns, equal parts', () => {
  it('gives each tree level one equal part', () => {
    const boxes = layoutColumns({ ...base, columnCount: 3, current: 1 });
    expect(boxes).toEqual([
      { x: 0, width: 250, contentWidth: 250 },
      { x: 250, width: 250, contentWidth: 250 },
      { x: 500, width: 250, contentWidth: 250 },
    ]);
  });

  it('does not move the columns when the current one changes', () => {
    const before = layoutColumns({ ...base, columnCount: 3, current: 1 });
    const after = layoutColumns({ ...base, columnCount: 3, current: 2 });
    expect(after).toEqual(before);
  });

  it('uses the whole width for a flat tree', () => {
    expect(layoutColumns({ ...base, depth: 1 })).toEqual([
      { x: 0, width: 1000, contentWidth: 1000 },
    ]);
  });

  it('still applies when a part is exactly the minimum content width', () => {
    expect(widths(layoutColumns({ ...base, depth: 5, columnCount: 2 }))).toEqual([
      200, 200,
    ]);
  });
});

describe('layoutColumns, shrinking', () => {
  // 400 wide, 6 levels: equal parts would be 66, below the minimum of 200.
  const narrow: LayoutInput = { ...base, width: 400, depth: 6 };

  it('shows the first column whole, with room for the preview', () => {
    const boxes = layoutColumns({ ...narrow, columnCount: 2, current: 0 });
    expect(boxes).toEqual([
      { x: 0, width: 200, contentWidth: 200 },
      { x: 200, width: 200, contentWidth: 200 },
    ]);
  });

  it('keeps the current column whole and at least 20% for the preview', () => {
    const boxes = layoutColumns({ ...narrow, columnCount: 4, current: 2 });
    // 400 - 200 current - 80 reserve = 120 of left space. Two collapsed columns
    // need 80; the spare 40 widen the preview.
    expect(widths(boxes)).toEqual([40, 40, 200, 120]);
    expect(boxes.map((box) => box.x)).toEqual([0, 40, 80, 280]);
    expect(boxes.every((box) => box.contentWidth === 200)).toBe(true);
  });

  it('shares the left space in equal parts, down to the collapsed minimum', () => {
    const boxes = layoutColumns({ ...narrow, columnCount: 5, current: 3 });
    expect(widths(boxes)).toEqual([40, 40, 40, 200, 80]);
  });

  it('hides the leftmost columns when they do not fit even collapsed', () => {
    const boxes = layoutColumns({ ...narrow, columnCount: 6, current: 5 });
    // 120 of left space fits three collapsed columns out of five.
    expect(widths(boxes)).toEqual([0, 0, 40, 40, 40, 200]);
    expect(boxes[2]?.x).toBe(0);
  });

  it('does not move the columns when a preview appears or disappears', () => {
    const withPreview = layoutColumns({ ...narrow, columnCount: 4, current: 2 });
    const without = layoutColumns({ ...narrow, columnCount: 3, current: 2 });
    expect(without).toEqual(withPreview.slice(0, 3));
  });

  it('reserves nothing when the current column has no group', () => {
    const boxes = layoutColumns({
      ...narrow,
      columnCount: 3,
      current: 2,
      reservePreview: false,
    });
    expect(widths(boxes)).toEqual([100, 100, 200]);
  });

  it('gives spare space to the preview before the left columns', () => {
    const boxes = layoutColumns({ ...narrow, width: 500, columnCount: 3, current: 1 });
    // 500 - 200 - 100 reserve = 200 left space, one left column needs 40:
    // 100 more go to the preview (now a full column), the rest to the left.
    expect(widths(boxes)).toEqual([100, 200, 200]);
  });

  it('never exceeds the component width', () => {
    for (let current = 0; current < 6; current++) {
      const boxes = layoutColumns({ ...narrow, columnCount: current + 2, current });
      const last = boxes.at(-1);
      expect(last === undefined ? 0 : last.x + last.width).toBeLessThanOrEqual(400);
    }
  });

  it('narrows the content when the minimum does not leave room for the preview', () => {
    const boxes = layoutColumns({ ...narrow, width: 220, columnCount: 2, current: 0 });
    expect(boxes).toEqual([
      { x: 0, width: 176, contentWidth: 176 },
      { x: 176, width: 44, contentWidth: 176 },
    ]);
  });
});

describe('layoutColumns, degenerate input', () => {
  it('returns nothing without columns or without width', () => {
    expect(layoutColumns({ ...base, columnCount: 0 })).toEqual([]);
    expect(layoutColumns({ ...base, width: 0 })).toEqual([]);
  });
});
