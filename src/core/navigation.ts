import {
  findPathByValue,
  getChildrenAt,
  getNodeAtPath,
  isEnabled,
  type NodePath,
  type TreeNode,
} from './tree';

/**
 * Where the user is in the tree.
 *
 * `selected` holds the chosen items, one per column starting from the first.
 * `highlighted` is the item under the pointer in the column that follows them;
 * it exists only during a gesture.
 */
export interface NavState {
  readonly selected: NodePath;
  readonly highlighted: number | null;
}

export const EMPTY_NAV_STATE: NavState = { selected: [], highlighted: null };

export type ItemState = 'idle' | 'highlighted' | 'selected';

/**
 * - `path`: a column the user has already chosen from.
 * - `current`: the column where the next choice happens.
 * - `preview`: the children of the highlighted group.
 */
export type ColumnRole = 'path' | 'current' | 'preview';

export interface NavColumn {
  /** Path of the group whose children this column shows; empty for the first. */
  readonly parentPath: NodePath;
  readonly items: readonly TreeNode[];
  readonly role: ColumnRole;
  /** Index of the selected or highlighted item, if any. */
  readonly activeIndex: number | null;
  readonly activeState: ItemState;
}

function selectionEndsOnOption(roots: readonly TreeNode[], state: NavState): boolean {
  return getNodeAtPath(roots, state.selected)?.kind === 'option';
}

/**
 * Index of the column where the next choice happens: the column of the selected
 * option if there is one, otherwise the column after the last selected group.
 */
export function currentColumnIndex(roots: readonly TreeNode[], state: NavState): number {
  return selectionEndsOnOption(roots, state)
    ? state.selected.length - 1
    : state.selected.length;
}

/** The columns to show, from left to right. */
export function visibleColumns(roots: readonly TreeNode[], state: NavState): NavColumn[] {
  const columns: NavColumn[] = [];
  const current = currentColumnIndex(roots, state);

  for (let index = 0; index <= state.selected.length; index++) {
    const parentPath = state.selected.slice(0, index);
    const items = getChildrenAt(roots, parentPath);
    if (items === undefined) break;

    const selectedIndex = state.selected[index];
    if (selectedIndex !== undefined) {
      columns.push({
        parentPath,
        items,
        role: index === current ? 'current' : 'path',
        activeIndex: selectedIndex,
        activeState: 'selected',
      });
    } else {
      columns.push({
        parentPath,
        items,
        role: 'current',
        activeIndex: state.highlighted,
        activeState: state.highlighted === null ? 'idle' : 'highlighted',
      });
    }
  }

  if (state.highlighted !== null) {
    const parentPath = [...state.selected, state.highlighted];
    const node = getNodeAtPath(roots, parentPath);
    if (node?.kind === 'group' && isEnabled(node)) {
      columns.push({
        parentPath,
        items: node.children,
        role: 'preview',
        activeIndex: null,
        activeState: 'idle',
      });
    }
  }

  return columns;
}

/**
 * The pointer is in column `column`, over item `index` (or over no item).
 *
 * Choices in the columns to the left are kept, the ones from `column` onwards are
 * dropped, and the item becomes highlighted. Moving into the preview column
 * selects the highlighted group. A column beyond the last visible one is treated
 * as the last visible one; a disabled or missing item highlights nothing.
 */
export function pointAt(
  roots: readonly TreeNode[],
  state: NavState,
  column: number,
  index: number | null,
): NavState {
  const lastColumn = visibleColumns(roots, state).length - 1;
  const target = Math.max(0, Math.min(column, lastColumn));

  const selected =
    target > state.selected.length && state.highlighted !== null
      ? [...state.selected, state.highlighted]
      : state.selected.slice(0, target);

  const item = index === null ? undefined : getChildrenAt(roots, selected)?.[index];
  const highlighted = item !== undefined && isEnabled(item) ? index : null;

  return { selected, highlighted };
}

/** The pointer is released: the highlighted item, if any, becomes selected. */
export function release(state: NavState): NavState {
  if (state.highlighted === null) return state;
  return { selected: [...state.selected, state.highlighted], highlighted: null };
}

/** The value of the selected option, or `''` when the path does not end on one. */
export function valueOf(roots: readonly TreeNode[], state: NavState): string {
  const node = getNodeAtPath(roots, state.selected);
  return node?.kind === 'option' ? node.value : '';
}

/** The state that shows `value` as selected, or the empty state if it is unknown. */
export function stateForValue(roots: readonly TreeNode[], value: string): NavState {
  const selected = findPathByValue(roots, value);
  return selected === undefined ? EMPTY_NAV_STATE : { selected, highlighted: null };
}

// Keyboard navigation.
//
// The keyboard moves a cursor, which is the highlighted item: it lives in the
// column after the selected path, exactly like the item under the pointer.

/** A move of the keyboard cursor within its column. */
export type CursorMove = 'next' | 'previous' | 'first' | 'last';

function enabledIndexes(items: readonly TreeNode[] | undefined): number[] {
  const indexes: number[] = [];
  for (const [index, node] of (items ?? []).entries()) {
    if (isEnabled(node)) indexes.push(index);
  }
  return indexes;
}

/**
 * Puts the keyboard cursor in the current column, if it is not there yet: on
 * the selected option if the path ends on one, otherwise on the first enabled
 * item of the column after the path. Nothing changes if there is no such item.
 */
export function placeCursor(roots: readonly TreeNode[], state: NavState): NavState {
  if (state.highlighted !== null) return state;
  if (getNodeAtPath(roots, state.selected)?.kind === 'option') {
    return {
      selected: state.selected.slice(0, -1),
      highlighted: state.selected.at(-1) ?? null,
    };
  }
  const first = enabledIndexes(getChildrenAt(roots, state.selected))[0];
  return first === undefined ? state : { selected: state.selected, highlighted: first };
}

/** Moves the cursor to another enabled item of its column. It does not wrap around. */
export function moveCursor(
  roots: readonly TreeNode[],
  state: NavState,
  move: CursorMove,
): NavState {
  const enabled = enabledIndexes(getChildrenAt(roots, state.selected));
  const current = state.highlighted;
  let target: number | undefined;
  if (move === 'first') target = enabled[0];
  else if (move === 'last') target = enabled.at(-1);
  else if (current === null) target = move === 'next' ? enabled[0] : enabled.at(-1);
  else if (move === 'next') target = enabled.find((index) => index > current);
  else target = enabled.filter((index) => index < current).at(-1);
  return target === undefined ? state : { selected: state.selected, highlighted: target };
}

/**
 * If the cursor is on an enabled group, selects it and moves the cursor to the
 * first enabled item of its column. Otherwise nothing changes.
 */
export function enterGroup(roots: readonly TreeNode[], state: NavState): NavState {
  if (state.highlighted === null) return state;
  const selected = [...state.selected, state.highlighted];
  const node = getNodeAtPath(roots, selected);
  if (node?.kind !== 'group' || !isEnabled(node)) return state;
  const first = enabledIndexes(node.children)[0];
  return first === undefined ? state : { selected, highlighted: first };
}

/**
 * Moves the cursor back to the previous column, on the group it came from,
 * which is no longer selected. In the first column nothing changes.
 */
export function goBack(state: NavState): NavState {
  const group = state.selected.at(-1);
  if (group === undefined) return state;
  return { selected: state.selected.slice(0, -1), highlighted: group };
}

/**
 * Moves the cursor to the next enabled item of its column whose label starts
 * with `text`, ignoring case, wrapping around. A single character searches
 * after the cursor, so typing it again cycles through the items with that
 * initial; longer text searches from the cursor, so it refines the match.
 */
export function findByPrefix(
  roots: readonly TreeNode[],
  state: NavState,
  text: string,
): NavState {
  const items = getChildrenAt(roots, state.selected) ?? [];
  if (items.length === 0 || text === '') return state;
  const wanted = text.toLocaleLowerCase();
  const start = (state.highlighted ?? -1) + (text.length === 1 ? 1 : 0);
  for (let step = 0; step < items.length; step++) {
    const index = (((start + step) % items.length) + items.length) % items.length;
    const node = items[index];
    if (node === undefined || !isEnabled(node)) continue;
    if (node.label.toLocaleLowerCase().startsWith(wanted)) {
      return { selected: state.selected, highlighted: index };
    }
  }
  return state;
}
