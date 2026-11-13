/**
 * Horizontal layout of the columns.
 *
 * There is never horizontal scrolling. When the columns do not fit, the ones to
 * the left of the current column shrink, and their content is clipped.
 */

/** Share of the width kept free to the right of the current column for the preview. */
export const PREVIEW_RESERVE = 0.2;

export interface LayoutInput {
  /** Inner width of the component, in pixels. */
  readonly width: number;
  /** Number of levels of the deepest branch of the tree. */
  readonly depth: number;
  /** Number of visible columns, the preview included. */
  readonly columnCount: number;
  /** Index of the current column. */
  readonly current: number;
  /** Whether the current column holds a group, and so may open a preview. */
  readonly reservePreview: boolean;
  /** Minimum width of the content of a column that is not shrunk. */
  readonly minContentWidth: number;
  /** Minimum width of a shrunk column. */
  readonly collapsedMinWidth: number;
}

export interface ColumnBox {
  /** Left edge, relative to the component. */
  readonly x: number;
  /** Visible width; 0 when the column is hidden. */
  readonly width: number;
  /** Width of the content, which is clipped when larger than `width`. */
  readonly contentWidth: number;
}

/**
 * Lays out the visible columns.
 *
 * - If one equal part of the width per tree level is at least
 *   `minContentWidth`, every column takes one part and nothing ever shrinks.
 * - Otherwise every column is `minContentWidth` wide. The current column is
 *   fully visible, `PREVIEW_RESERVE` of the width stays free to its right when
 *   it may open a preview, and the columns to its left share what remains in
 *   equal parts, down to `collapsedMinWidth`. If they still do not fit, the
 *   leftmost ones are hidden.
 *
 * The result does not depend on which item is highlighted, so the columns do not
 * move while the pointer travels along the current one.
 */
export function layoutColumns(input: LayoutInput): ColumnBox[] {
  const { width, depth, columnCount, current } = input;
  if (columnCount <= 0 || width <= 0) return [];

  const equalPart = width / Math.max(1, depth);
  if (equalPart >= input.minContentWidth) {
    return Array.from({ length: columnCount }, (_, index) => ({
      x: index * equalPart,
      width: equalPart,
      contentWidth: equalPart,
    }));
  }

  const reserve = input.reservePreview ? PREVIEW_RESERVE * width : 0;
  const contentWidth = Math.min(input.minContentWidth, width - reserve);
  const collapsed = Math.min(input.collapsedMinWidth, contentWidth);

  // Space for the columns to the left of the current one.
  const leftSpace = width - contentWidth - reserve;
  const leftCount = Math.min(current, columnCount);
  const shown =
    collapsed > 0 ? Math.min(leftCount, Math.floor(leftSpace / collapsed)) : 0;
  const hidden = leftCount - shown;

  // Anything the left columns do not need at their minimum goes first to the
  // preview, up to a full column, then back to the left columns.
  const spare = leftSpace - shown * collapsed;
  const previewExtra = input.reservePreview
    ? Math.min(spare, Math.max(0, contentWidth - reserve))
    : 0;
  const leftWidth =
    shown === 0 ? 0 : Math.min(contentWidth, collapsed + (spare - previewExtra) / shown);

  const boxes: ColumnBox[] = [];
  let x = 0;
  for (let index = 0; index < columnCount; index++) {
    let columnWidth: number;
    if (index < hidden) columnWidth = 0;
    else if (index < current) columnWidth = leftWidth;
    else if (index === current) columnWidth = contentWidth;
    else if (index === current + 1) columnWidth = reserve + previewExtra;
    else columnWidth = 0;
    boxes.push({ x, width: columnWidth, contentWidth });
    x += columnWidth;
  }
  return boxes;
}
