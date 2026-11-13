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
