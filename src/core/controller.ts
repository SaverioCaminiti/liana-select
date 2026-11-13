import { columnUnder, isInside, itemUnder } from './hit-test';
import { layoutColumns, type ColumnBox } from './layout';
import {
  currentColumnIndex,
  EMPTY_NAV_STATE,
  enterGroup,
  findByPrefix,
  goBack,
  moveCursor,
  placeCursor,
  pointAt,
  release,
  stateForValue,
  valueOf,
  visibleColumns,
  type ColumnRole,
  type CursorMove,
  type ItemState,
  type NavColumn,
  type NavState,
} from './navigation';
import {
  anchoredScroll,
  scrollRange,
  scrollToReveal,
  snapScroll,
  type ColumnMetrics,
  type ScrollAnchor,
} from './scroll';
import {
  getNodeAtPath,
  isEnabled,
  treeDepth,
  type NodePath,
  type TreeNode,
} from './tree';

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
  collapsedMinWidth: 64,
  hysteresis: 8,
  backtrackTravel: 24,
};

export interface ItemView {
  readonly node: TreeNode;
  readonly state: ItemState;
  /** Position of the item in the tree: a stable identity, for example for ARIA. */
  readonly path: NodePath;
  /** Whether the item is a group whose children are shown in the next column. */
  readonly expanded: boolean;
}

/**
 * What a key asks the keyboard cursor to do.
 *
 * - `next`, `previous`, `first`, `last`: move within the column.
 * - `enter`: go into the group under the cursor.
 * - `back`: go back to the previous column.
 * - `confirm`: on an option, select it and commit the value; on a group, enter it.
 * - `cancel`: drop the navigation and restore the selection it started from.
 */
export type KeyboardAction = CursorMove | 'enter' | 'back' | 'confirm' | 'cancel';

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
  /** Whether a keyboard navigation is in progress. */
  readonly keyboard: boolean;
  /** Path of the highlighted item: under the pointer, or under the keyboard cursor. */
  readonly cursor: NodePath | null;
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

/** A keyboard navigation in progress, from the first key to confirm or cancel. */
interface KeyboardSession {
  readonly startNav: NavState;
  readonly startScroll: ReadonlyMap<string, number>;
  readonly startValue: string;
}

export function columnKey(parentPath: NodePath): string {
  return `/${parentPath.join('/')}`;
}

/**
 * Measurements closer than this many pixels are the same measurement. Browsers
 * report positions with rounding noise that depends on the scroll offset, and
 * reacting to that noise would never settle: every draw would change it again.
 */
const METRICS_TOLERANCE = 0.05;

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= METRICS_TOLERANCE;
}

function sameMetrics(a: ColumnMetrics | undefined, b: ColumnMetrics): boolean {
  if (a === undefined || !close(a.height, b.height)) return false;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((item, index) => {
    const other = b.items[index];
    return (
      other !== undefined &&
      close(item.top, other.top) &&
      close(item.height, other.height)
    );
  });
}

function sameScroll(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
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
  /**
   * Called when a gesture, or a keyboard navigation, ends with a value
   * different from the one it started with.
   */
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
  #keyboard: KeyboardSession | undefined;
  /** Whether selected items still have to be scrolled into view. */
  #revealPending = false;

  constructor(options: Partial<ControllerOptions> = {}) {
    this.#options = { ...DEFAULT_CONTROLLER_OPTIONS, ...options };
  }

  /**
   * The committed value. While a gesture or a keyboard navigation is in
   * progress it is the value they started from: it changes only when they end.
   */
  get value(): string {
    return (
      this.#gesture?.startValue ??
      this.#keyboard?.startValue ??
      valueOf(this.#roots, this.#nav)
    );
  }

  get view(): ControllerView {
    const columns = this.#columns();
    const boxes = this.#boxes(columns);
    const cursor = this.#nav.highlighted;
    return {
      value: this.value,
      active: this.#gesture !== undefined,
      keyboard: this.#keyboard !== undefined,
      cursor: cursor === null ? null : [...this.#nav.selected, cursor],
      columns: columns.map((column, index) => {
        const key = columnKey(column.parentPath);
        const box = boxes[index] ?? { x: 0, width: 0, contentWidth: 0 };
        return {
          ...box,
          key,
          parentPath: column.parentPath,
          role: column.role,
          scroll: this.#scroll.get(key) ?? 0,
          items: column.items.map((node, itemIndex) => {
            const state = itemIndex === column.activeIndex ? column.activeState : 'idle';
            const opensNext = columns[index + 1] !== undefined;
            return {
              node,
              state,
              path: [...column.parentPath, itemIndex],
              expanded: node.kind === 'group' && state !== 'idle' && opensNext,
            };
          }),
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
   * To be called after every draw.
   *
   * Measuring follows drawing, and a new measurement can ask for a new draw:
   * this must settle. So it asks for one only when what is drawn would change,
   * and measurements that differ by rounding noise count as equal.
   */
  setMetrics(metrics: ReadonlyMap<string, ColumnMetrics>): void {
    let changed = false;
    for (const [key, columnMetrics] of metrics) {
      if (sameMetrics(this.#metrics.get(key), columnMetrics)) continue;
      this.#metrics.set(key, columnMetrics);
      changed = true;
    }
    if (!changed) return;

    const navBefore = this.#nav;
    const scrollBefore = new Map(this.#scroll);
    if (this.#gesture !== undefined) {
      // The column under the pointer may have just been measured: choose in it,
      // and follow the pointer on if that opens a column under it.
      this.#follow(this.#gesture);
    } else {
      this.#settleScroll();
      // The column of the keyboard cursor may have just been measured.
      if (this.#keyboard !== undefined) this.#revealCursor();
    }

    const sameNav =
      this.#nav.highlighted === navBefore.highlighted &&
      this.#nav.selected.length === navBefore.selected.length &&
      this.#nav.selected.every((index, level) => index === navBefore.selected[level]);
    if (!sameNav || !sameScroll(scrollBefore, this.#scroll)) this.#changed();
  }

  pointerDown(x: number, y: number): void {
    if (this.#gesture !== undefined) return;
    // A gesture takes over from the keyboard, from the last committed state.
    if (this.#keyboard !== undefined) this.#endKeyboard(true);
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
    this.#follow(gesture);
    this.#changed();
  }

  pointerMove(x: number, y: number): void {
    const gesture = this.#gesture;
    if (gesture === undefined) return;
    gesture.x = this.#clampX(x);
    gesture.y = this.#clampY(y);
    this.#follow(gesture);
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

  /**
   * The component got the keyboard focus: show the cursor, so that the user
   * sees where the keys will act. Nothing happens during a gesture.
   */
  keyboardFocus(): void {
    if (this.#gesture !== undefined) return;
    if (this.#startKeyboard()) this.#changed();
  }

  /**
   * Applies a key. Returns whether it did something, so that the element knows
   * whether to consume the key: Escape with nothing to cancel, for example, is
   * left to the page.
   *
   * The first key places the cursor. An arrow up or down that only places it
   * does not move it as well, so the user first sees where it is.
   */
  keyboard(action: KeyboardAction): boolean {
    if (this.#gesture !== undefined) return false;
    if (action === 'cancel') {
      if (this.#keyboard === undefined) return false;
      this.#endKeyboard(true);
      this.#changed();
      return true;
    }

    const started = this.#startKeyboard();
    const before = this.#nav;
    switch (action) {
      case 'next':
      case 'previous':
        if (!started) this.#nav = moveCursor(this.#roots, this.#nav, action);
        break;
      case 'first':
      case 'last':
        this.#nav = moveCursor(this.#roots, this.#nav, action);
        break;
      case 'enter':
        this.#nav = enterGroup(this.#roots, this.#nav);
        break;
      case 'back':
        this.#nav = goBack(this.#nav);
        break;
      case 'confirm':
        this.#confirm();
        break;
    }
    const changed = started || this.#nav !== before || action === 'confirm';
    if (this.#keyboard !== undefined) this.#revealCursor();
    this.#pruneScroll();
    this.#changed();
    return changed;
  }

  /** Moves the cursor to the next item whose label starts with `text`. */
  typeahead(text: string): boolean {
    if (this.#gesture !== undefined || text === '') return false;
    const started = this.#startKeyboard();
    const before = this.#nav;
    this.#nav = findByPrefix(this.#roots, this.#nav, text);
    this.#revealCursor();
    this.#pruneScroll();
    this.#changed();
    return started || this.#nav !== before;
  }

  /** The keyboard focus left the component: drop what was not confirmed. */
  keyboardBlur(): void {
    if (this.#keyboard === undefined) return;
    this.#endKeyboard(true);
    this.#changed();
  }

  /** Starts a keyboard navigation if none is in progress. Returns whether it did. */
  #startKeyboard(): boolean {
    if (this.#keyboard !== undefined) return false;
    this.#keyboard = {
      startNav: this.#nav,
      startScroll: new Map(this.#scroll),
      startValue: this.value,
    };
    this.#revealPending = false;
    this.#nav = placeCursor(this.#roots, this.#nav);
    this.#revealCursor();
    return true;
  }

  /** Confirm: select an option and commit, or enter a group. */
  #confirm(): void {
    const session = this.#keyboard;
    if (session === undefined || this.#nav.highlighted === null) return;
    const entered = enterGroup(this.#roots, this.#nav);
    if (entered !== this.#nav) {
      this.#nav = entered;
      return;
    }
    const node = getNodeAtPath(this.#roots, [
      ...this.#nav.selected,
      this.#nav.highlighted,
    ]);
    if (node?.kind !== 'option') return;
    this.#nav = release(this.#nav);
    this.#keyboard = undefined;
    const value = this.value;
    if (value !== session.startValue) this.onValueCommit?.(value);
  }

  /** Ends the keyboard navigation; `restore` puts back the state it started from. */
  #endKeyboard(restore: boolean): void {
    const session = this.#keyboard;
    if (session === undefined) return;
    this.#keyboard = undefined;
    if (restore) {
      this.#nav = session.startNav;
      this.#scroll = new Map(session.startScroll);
    }
  }

  /** Scrolls the column of the cursor so that the cursor is fully visible. */
  #revealCursor(): void {
    const index = this.#nav.highlighted;
    if (index === null) return;
    const key = columnKey(this.#nav.selected);
    const metrics = this.#metrics.get(key);
    const item = metrics?.items[index];
    if (metrics === undefined || item === undefined) return;
    const scroll = scrollToReveal(this.#scroll.get(key) ?? 0, item, metrics);
    this.#scroll.set(key, snapScroll(scroll, scrollRange(metrics).max));
  }

  #reset(nav: NavState): void {
    this.#gesture = undefined;
    this.#keyboard = undefined;
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
   * Brings the state in line with the pointer: changes column as long as the
   * pointer belongs to another one, then chooses the item under it.
   *
   * A change of column can move the layout, and so put the pointer over yet
   * another column without it moving: going right, choosing in the new column
   * can open a preview right under the pointer. The loop follows, one level at
   * a time, so that what ends up chosen is what the user sees under the
   * pointer. It stops on an option, an empty area, a column whose layout did not
   * move, or a column not measured yet; `setMetrics` resumes it then. The tree
   * depth bounds the number of steps.
   */
  #follow(gesture: Gesture): void {
    // Each step changes column, or chooses and stops: every column of the tree
    // can be entered once going right and once going left at most.
    for (let step = 0; step <= 2 * this.#depth + 1; step++) {
      // Judge the column first, on what is drawn: the pointer moved over it.
      const current = currentColumnIndex(this.#roots, this.#nav);
      const target = this.#targetColumn(gesture);
      if (target !== current) {
        this.#enterColumn(gesture, target, !gesture.engaged && target < current);
        // Choose in the new column, so that its preview exists for the next step.
        this.#point(gesture);
        continue;
      }
      // Then choose in it. That may open a preview right under the pointer.
      this.#point(gesture);
      if (this.#targetColumn(gesture) === current) return;
    }
  }

  /**
   * The column the pointer belongs to, judged on the layout as it is drawn now.
   *
   * Normally it is the column under the pointer, with some hysteresis at the
   * borders of the current one. To the right this always holds: when the pointer
   * is over the next column, by more than the hysteresis, it belongs to it, even
   * right after a change of column moved the layout under it.
   *
   * To the left it does not. Going back makes the columns wider, which can leave
   * the pointer to the left of the column it has just entered, over an even
   * earlier one. Following that would jump back several levels at once. So,
   * until the pointer has been inside the new current column, it goes back one
   * more column for every `backtrackTravel` pixels of further travel to the
   * left: sliding left leads back to the first column, one level at a time.
   */
  #targetColumn(gesture: Gesture): number {
    const columns = this.#columns();
    const boxes = this.#boxes(columns);
    const current = currentColumnIndex(this.#roots, this.#nav);
    const box = boxes[current];
    if (box === undefined) return current;
    const { hysteresis, backtrackTravel } = this.#options;

    const next = boxes[current + 1];
    if (next !== undefined && next.width > 0 && gesture.x >= next.x + hysteresis) {
      return current + 1;
    }

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
    return current;
  }

  /**
   * Makes `target` the current column and anchors its scroll at the pointer.
   * `drifting` tells that the pointer got here by going back over shrunk columns,
   * without having been inside the previous one. The caller chooses the item.
   */
  #enterColumn(gesture: Gesture, target: number, drifting = false): void {
    const before = this.#boxes(this.#columns())[target];
    this.#nav = pointAt(this.#roots, this.#nav, target, null);
    const columns = this.#columns();
    const current = currentColumnIndex(this.#roots, this.#nav);
    const column = columns[current];
    const key = column === undefined ? '' : columnKey(column.parentPath);
    const after = this.#boxes(columns)[current];
    // If the column did not move, the pointer is where the user sees it: there
    // is nothing to protect against, even when it is not inside the column.
    const moved = before?.x !== after?.x || before?.width !== after?.width;

    gesture.anchorKey = key;
    gesture.anchor = { y: gesture.y, scroll: this.#scroll.get(key) ?? 0 };
    gesture.engaged = !moved || isInside(gesture.x, after);
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
      const range = scrollRange(metrics);
      const scroll = snapScroll(
        anchoredScroll(gesture.y, range, gesture.anchor),
        range.max,
      );
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
      let scroll = this.#scroll.get(key) ?? 0;
      const selected =
        column.activeIndex === null ? undefined : metrics.items[column.activeIndex];
      if (this.#revealPending && selected !== undefined) {
        scroll = scrollToReveal(scroll, selected, metrics);
      }
      this.#scroll.set(key, snapScroll(scroll, scrollRange(metrics).max));
    }
    if (allMeasured) this.#revealPending = false;
    this.#pruneScroll();
  }
}
