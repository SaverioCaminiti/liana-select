import { describe, expect, it } from 'vitest';
import {
  currentColumnIndex,
  EMPTY_NAV_STATE,
  pointAt,
  release,
  stateForValue,
  valueOf,
  visibleColumns,
  type NavState,
} from './navigation';
import { menu } from './test-fixtures';

/** Compact description of the visible columns, for assertions. */
function describeColumns(state: NavState): string[] {
  return visibleColumns(menu, state).map((column) => {
    const active =
      column.activeIndex === null
        ? ''
        : ` ${column.activeState}:${column.items[column.activeIndex]?.label ?? '?'}`;
    return `${column.role}(${String(column.items.length)})${active}`;
  });
}

describe('visibleColumns', () => {
  it('shows only the first column at the start', () => {
    expect(describeColumns(EMPTY_NAV_STATE)).toEqual(['current(4)']);
  });

  it('shows the children of a highlighted group as a preview', () => {
    const state = pointAt(menu, EMPTY_NAV_STATE, 0, 0);
    expect(describeColumns(state)).toEqual([
      'current(4) highlighted:pizza',
      'preview(3)',
    ]);
  });

  it('shows no preview for a highlighted option', () => {
    const state = pointAt(menu, EMPTY_NAV_STATE, 0, 2);
    expect(describeColumns(state)).toEqual(['current(4) highlighted:bread']);
  });

  it('shows the whole path of a selected value', () => {
    expect(describeColumns(stateForValue(menu, 'seafood'))).toEqual([
      'path(4) selected:pizza',
      'path(3) selected:special',
      'current(2) selected:seafood',
    ]);
  });
});

describe('pointAt', () => {
  it('moves the highlight within a column', () => {
    let state = pointAt(menu, EMPTY_NAV_STATE, 0, 0);
    state = pointAt(menu, state, 0, 1);
    expect(state).toEqual({ selected: [], highlighted: 1 });
    expect(describeColumns(state)).toEqual([
      'current(4) highlighted:drinks',
      'preview(2)',
    ]);
  });

  it('selects the highlighted group when the pointer enters the preview', () => {
    let state = pointAt(menu, EMPTY_NAV_STATE, 0, 0);
    state = pointAt(menu, state, 1, 1);
    expect(state).toEqual({ selected: [0], highlighted: 1 });
    expect(describeColumns(state)).toEqual([
      'path(4) selected:pizza',
      'current(3) highlighted:special',
      'preview(2)',
    ]);
  });

  it('goes back to an earlier column and replaces what follows', () => {
    let state = pointAt(menu, EMPTY_NAV_STATE, 0, 0);
    state = pointAt(menu, state, 1, 1);
    state = pointAt(menu, state, 2, 0);
    state = pointAt(menu, state, 0, 1);
    expect(state).toEqual({ selected: [], highlighted: 1 });
  });

  it('clears highlight and preview over an empty area', () => {
    let state = pointAt(menu, EMPTY_NAV_STATE, 0, 0);
    state = pointAt(menu, state, 0, null);
    expect(describeColumns(state)).toEqual(['current(4)']);
  });

  it('does not highlight disabled items, empty groups or missing items', () => {
    expect(pointAt(menu, EMPTY_NAV_STATE, 0, 3).highlighted).toBeNull();
    expect(pointAt(menu, EMPTY_NAV_STATE, 0, 9).highlighted).toBeNull();
    const inDrinks = pointAt(menu, pointAt(menu, EMPTY_NAV_STATE, 0, 1), 1, 1);
    expect(inDrinks).toEqual({ selected: [1], highlighted: null });
  });

  it('treats a column beyond the last visible one as the last one', () => {
    const onBread = pointAt(menu, EMPTY_NAV_STATE, 0, 2);
    expect(pointAt(menu, onBread, 3, 2)).toEqual({ selected: [], highlighted: 2 });
  });

  it('restarts from an earlier column of a selected value', () => {
    const state = pointAt(menu, stateForValue(menu, 'seafood'), 1, 0);
    expect(state).toEqual({ selected: [0], highlighted: 0 });
  });
});

describe('release', () => {
  it('selects a highlighted group and waits in the next column', () => {
    const state = release(pointAt(menu, EMPTY_NAV_STATE, 0, 0));
    expect(state).toEqual({ selected: [0], highlighted: null });
    expect(currentColumnIndex(menu, state)).toBe(1);
    expect(describeColumns(state)).toEqual(['path(4) selected:pizza', 'current(3)']);
  });

  it('selects a highlighted option and keeps its column current', () => {
    const state = release(pointAt(menu, EMPTY_NAV_STATE, 0, 2));
    expect(currentColumnIndex(menu, state)).toBe(0);
    expect(describeColumns(state)).toEqual(['current(4) selected:bread']);
  });

  it('changes nothing when no item is highlighted', () => {
    const state = pointAt(menu, EMPTY_NAV_STATE, 0, null);
    expect(release(state)).toBe(state);
  });
});

describe('valueOf', () => {
  it('is empty until an option is selected', () => {
    expect(valueOf(menu, EMPTY_NAV_STATE)).toBe('');
    expect(valueOf(menu, pointAt(menu, EMPTY_NAV_STATE, 0, 2))).toBe('');
    expect(valueOf(menu, release(pointAt(menu, EMPTY_NAV_STATE, 0, 0)))).toBe('');
  });

  it('is the value of the selected option', () => {
    expect(valueOf(menu, release(pointAt(menu, EMPTY_NAV_STATE, 0, 2)))).toBe('bread');
  });

  it('is cleared when a gesture restarts from an earlier column', () => {
    const state = pointAt(menu, stateForValue(menu, 'seafood'), 0, 1);
    expect(valueOf(menu, release(state))).toBe('');
  });
});

describe('stateForValue', () => {
  it('round-trips through valueOf', () => {
    expect(valueOf(menu, stateForValue(menu, 'water'))).toBe('water');
  });

  it('is the empty state for an unknown value', () => {
    expect(stateForValue(menu, 'sushi')).toBe(EMPTY_NAV_STATE);
  });
});
