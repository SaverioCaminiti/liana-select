import { columnUnder, isInside, itemUnder } from './hit-test';
import { layoutColumns, type ColumnBox } from './layout';
import {
  currentColumnIndex,
  EMPTY_NAV_STATE,
  pointAt,
  release,
  stateForValue,
  valueOf,
  visibleColumns,
  type ColumnRole,
  type ItemState,
  type NavColumn,
  type NavState,
} from './navigation';
import {
  anchoredScroll,
  scrollRange,
  scrollToReveal,
  type ColumnMetrics,
  type ScrollAnchor,
} from './scroll';
import { isEnabled, treeDepth, type NodePath, type TreeNode } from './tree';

export interface ControllerOptions {
  /** Minimum width of the content of a column that is not shrunk, in pixels. */
  readonly minContentWidth: number;
  /** Minimum width of a shrunk column, in pixels. */
  readonly collapsedMinWidth: number;
  /**
   * How far beyond the border of the current column the pointer must go before
   * it counts as being in another column. Avoids flicker at the border.
   */
  readonly hysteresis: number;
  /**
   * When the layout has moved the current column away from under the pointer,
   * how far left the pointer must travel to go back one more column.
   */
  readonly backtrackTravel: number;
}

export const DEFAULT_CONTROLLER_OPTIONS: ControllerOptions = {
  minContentWidth: 160,
  collapsedMinWidth: 32,
  hysteresis: 8,
  backtrackTravel: 24,
};

export interface ItemView {
  readonly node: TreeNode;
  readonly state: ItemState;
}

/** Everything needed to draw one column. */
export interface ColumnView extends ColumnBox {
  /** Stable identity of the column: it changes when the column shows other items. */
  readonly key: string;
  readonly parentPath: NodePath;
  readonly role: ColumnRole;
  readonly items: readonly ItemView[];
  /** Vertical scroll offset of the content, in pixels. */
  readonly scroll: number;
}

export interface ControllerView {
  readonly columns: readonly ColumnView[];
  readonly value: string;
  /** Whether a gesture is in progress. */
  readonly active: boolean;
}

interface Gesture {
  readonly startNav: NavState;
  readonly startScroll: ReadonlyMap<string, number>;
  readonly startValue: string;
  x: number;
  y: number;
  /** Key of the column the anchor belongs to, and the anchor itself. */
  anchorKey: string;
  anchor: ScrollAnchor;
  /** Whether the pointer has been inside the current column since it became current. */
  engaged: boolean;
  /** Where the pointer was when it last stopped being inside the current column. */
  driftOriginX: number;
  /** Columns gone back since then without getting inside one. */
  driftSteps: number;
}

export function columnKey(parentPath: NodePath): string {
  return `/${parentPath.join('/')}`;
}

function sameMetrics(a: ColumnMetrics | undefined, b: ColumnMetrics): boolean {
  if (a?.height !== b.height || a.items.length !== b.items.length) return false;
  return a.items.every((item, index) => {
    const other = b.items[index];
    return item.top === other?.top && item.height === other.height;
  });
}

/**
 * The state machine behind `<liana-select>`.
 *
 * It owns the tree, the navigation state and the scroll offsets, and turns
 * pointer positions into a view to draw. It knows nothing about the DOM: the
 * element feeds it sizes and measurements in pixels, with pointer coordinates
 * relative to the top left corner of the area that holds the columns.
 */
export class LianaController {
  /** Called whenever the view may have changed. */
  onViewChange: (() => void) | undefined;
  /** Called when a gesture ends with a value different from the one it started with. */
  onValueCommit: ((value: string) => void) | undefined;

  #roots: readonly TreeNode[] = [];
  #depth = 0;
  #nav: NavState = EMPTY_NAV_STATE;
  #options: ControllerOptions;
  #width = 0;
  #height = 0;
  #metrics = new Map<string, ColumnMetrics>();
  #scroll = new Map<string, number>();
  #gesture: Gesture | undefined;
  /** Whether selected items still have to be scrolled into view. */
  #revealPending = false;

  constructor(options: Partial<ControllerOptions> = {}) {
    this.#options = { ...DEFAULT_CONTROLLER_OPTIONS, ...options };
  }

  get value(): string {
    return valueOf(this.#roots, this.#nav);
  }

  get view(): ControllerView {
    const columns = this.#columns();
    const boxes = this.#boxes(columns);
    return {
      value: this.value,
      active: this.#gesture !== undefined,
      columns: columns.map((column, index) => {
        const key = columnKey(column.parentPath);
        const box = boxes[index] ?? { x: 0, width: 0, contentWidth: 0 };
        return {
          ...box,
          key,
          parentPath: column.parentPath,
          role: column.role,
          scroll: this.#scroll.get(key) ?? 0,
          items: column.items.map((node, itemIndex) => ({
            node,
            state: itemIndex === column.activeIndex ? column.activeState : 'idle',
          })),
        };
      }),
    };
  }

  /** Replaces the tree. The value is kept if the new tree still has it. */
  setTree(roots: readonly TreeNode[]): void {
    const value = this.value;
    this.#roots = roots;
    this.#depth = treeDepth(roots);
    this.#metrics.clear();
    this.#reset(stateForValue(roots, value));
  }

  /** Selects the option with the given value, or nothing if there is none. */
  setValue(value: string): void {
    this.#reset(stateForValue(this.#roots, value));
  }

  setOptions(options: Partial<ControllerOptions>): void {
    const next = { ...this.#options, ...options };
    const keys = Object.keys(next) as (keyof ControllerOptions)[];
    if (keys.every((key) => next[key] === this.#options[key])) return;
    this.#options = next;
    this.#changed();
  }

  /** Sets the inner size of the area that holds the columns. */
  setSize(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return;
    this.#width = width;
    this.#height = height;
    this.#changed();
  }

  /**
   * Sets the measured geometry of the columns currently drawn, by column key.
   * To be called after every draw; it does nothing when the numbers are the same.
   */
  setMetrics(metrics: ReadonlyMap<string, ColumnMetrics>): void {
    let changed = false;
    for (const [key, columnMetrics] of metrics) {
      if (sameMetrics(this.#metrics.get(key), columnMetrics)) continue;
      this.#metrics.set(key, columnMetrics);
      changed = true;
    }
    if (!changed) return;

    if (this.#gesture !== undefined) {
      // The column under the pointer may have just been measured.
      this.#point(this.#gesture);
    } else {
      this.#settleScroll();
    }
    this.#changed();
  }

  pointerDown(x: number, y: number): void {
    if (this.#gesture !== undefined) return;
    const boxes = this.#boxes(this.#columns());
    const target = columnUnder(this.#clampX(x), boxes);
    if (target < 0) return;

    const gesture: Gesture = {
      startNav: this.#nav,
      startScroll: new Map(this.#scroll),
      startValue: this.value,
      x: this.#clampX(x),
      y: this.#clampY(y),
      anchorKey: '',
      anchor: { y: 0, scroll: 0 },
      engaged: false,
      driftOriginX: 0,
      driftSteps: 0,
    };
    this.#gesture = gesture;
    this.#revealPending = false;
    this.#enterColumn(gesture, target);
    this.#point(gesture);
    this.#changed();
  }

  pointerMove(x: number, y: number): void {
    const gesture = this.#gesture;
    if (gesture === undefined) return;
    gesture.x = this.#clampX(x);
    gesture.y = this.#clampY(y);

    // Sliding left over shrunk columns can go back several columns in one move.
    for (;;) {
      const current = currentColumnIndex(this.#roots, this.#nav);
      const target = this.#targetColumn(gesture);
      if (target === current) break;
      this.#enterColumn(gesture, target, !gesture.engaged && target < current);
    }
    this.#point(gesture);
    this.#changed();
  }

  pointerUp(): void {
    const gesture = this.#gesture;
    if (gesture === undefined) return;
    this.#gesture = undefined;
    this.#nav = release(this.#nav);
    this.#pruneScroll();
    this.#changed();

    const value = this.value;
    if (value !== gesture.startValue) this.onValueCommit?.(value);
  }

  /** The system interrupted the gesture: go back to where it started. */
  pointerCancel(): void {
    const gesture = this.#gesture;
    if (gesture === undefined) return;
    this.#gesture = undefined;
    this.#nav = gesture.startNav;
    this.#scroll = new Map(gesture.startScroll);
    this.#changed();
  }

  #reset(nav: NavState): void {
    this.#gesture = undefined;
    this.#nav = nav;
    this.#scroll.clear();
    this.#revealPending = true;
    this.#settleScroll();
    this.#changed();
  }

  #changed(): void {
    this.onViewChange?.();
  }

  #clampX(x: number): number {
    return Math.max(0, Math.min(x, this.#width));
  }

  #clampY(y: number): number {
    return Math.max(0, Math.min(y, this.#height));
  }

  #columns(): NavColumn[] {
    return visibleColumns(this.#roots, this.#nav);
  }

  #boxes(columns: readonly NavColumn[]): ColumnBox[] {
    const current = currentColumnIndex(this.#roots, this.#nav);
    const items = columns[current]?.items ?? [];
    return layoutColumns({
      width: this.#width,
      depth: this.#depth,
      columnCount: columns.length,
      current,
      reservePreview: items.some((node) => node.kind === 'group' && isEnabled(node)),
      minContentWidth: this.#options.minContentWidth,
      collapsedMinWidth: this.#options.collapsedMinWidth,
    });
  }

  /**
   * The column the pointer belongs to, judged on the layout as it is drawn now.
   *
   * Normally it is the column under the pointer, with some hysteresis at the
   * borders of the current one. But a change of column can move the layout, and
   * leave the pointer outside the column it has just entered. Until the pointer
   * has been inside that column:
   * - to its right, the pointer stays in it, so that the levels do not open in a
   *   cascade under a pointer that is not moving;
   * - to its left, the pointer goes back one column for every `backtrackTravel`
   *   pixels of further travel to the left, so that sliding left always leads
   *   back to the first column, one level at a time.
   */
  #targetColumn(gesture: Gesture): number {
    const columns = this.#columns();
    const boxes = this.#boxes(columns);
    const current = currentColumnIndex(this.#roots, this.#nav);
    const box = boxes[current];
    if (box === undefined) return current;
    const { hysteresis, backtrackTravel } = this.#options;

    if (!gesture.engaged) {
      if (isInside(gesture.x, box)) {
        gesture.engaged = true;
        return current;
      }
      const allowedSteps = Math.floor(
        (gesture.driftOriginX - gesture.x) / backtrackTravel,
      );
      const canGoBack = gesture.x < box.x && gesture.driftSteps < allowedSteps;
      return canGoBack ? Math.max(0, current - 1) : current;
    }

    if (gesture.x < box.x - hysteresis) return columnUnder(gesture.x, boxes);
    const next = boxes[current + 1];
    if (next !== undefined && next.width > 0 && gesture.x >= next.x + hysteresis) {
      return current + 1;
    }
    return current;
  }

  /**
   * Makes `target` the current column and anchors its scroll at the pointer.
   * `drifting` tells that the pointer got here by going back over shrunk columns,
   * without having been inside the previous one.
   */
  #enterColumn(gesture: Gesture, target: number, drifting = false): void {
    this.#nav = pointAt(this.#roots, this.#nav, target, null);
    const columns = this.#columns();
    const current = currentColumnIndex(this.#roots, this.#nav);
    const column = columns[current];
    const key = column === undefined ? '' : columnKey(column.parentPath);

    gesture.anchorKey = key;
    gesture.anchor = { y: gesture.y, scroll: this.#scroll.get(key) ?? 0 };
    gesture.engaged = isInside(gesture.x, this.#boxes(columns)[current]);
    if (drifting) {
      gesture.driftSteps += 1;
    } else {
      gesture.driftOriginX = gesture.x;
      gesture.driftSteps = 0;
    }
  }

  /** Scrolls the current column for the pointer height and highlights the item under it. */
  #point(gesture: Gesture): void {
    const current = currentColumnIndex(this.#roots, this.#nav);
    const column = this.#columns()[current];
    if (column === undefined) return;
    const key = columnKey(column.parentPath);
    const metrics = this.#metrics.get(key);

    let index: number | null = null;
    if (metrics !== undefined && key === gesture.anchorKey) {
      const scroll = anchoredScroll(gesture.y, scrollRange(metrics), gesture.anchor);
      this.#scroll.set(key, scroll);
      index = itemUnder(gesture.y + scroll, metrics.items);
    }
    this.#nav = pointAt(this.#roots, this.#nav, current, index);
    this.#pruneScroll();
  }

  /** Forgets the scroll offset of the columns that are no longer shown. */
  #pruneScroll(): void {
    const keys = new Set(this.#columns().map((column) => columnKey(column.parentPath)));
    for (const key of this.#scroll.keys()) {
      if (!keys.has(key)) this.#scroll.delete(key);
    }
  }

  /**
   * With no gesture in progress: keeps the offsets within their range and, after
   * the value was set from outside, scrolls the selected items into view.
   */
  #settleScroll(): void {
    let allMeasured = true;
    for (const column of this.#columns()) {
      const key = columnKey(column.parentPath);
      const metrics = this.#metrics.get(key);
      if (metrics === undefined) {
        allMeasured = false;
        continue;
      }
      let scroll = Math.min(this.#scroll.get(key) ?? 0, scrollRange(metrics).max);
      const selected =
        column.activeIndex === null ? undefined : metrics.items[column.activeIndex];
      if (this.#revealPending && selected !== undefined) {
        scroll = scrollToReveal(scroll, selected, metrics);
      }
      this.#scroll.set(key, scroll);
    }
    if (allMeasured) this.#revealPending = false;
    this.#pruneScroll();
  }
}
