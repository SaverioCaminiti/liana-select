import { describe, expect, it } from 'vitest';
import {
  EMPTY_NAV_STATE,
  enterGroup,
  findByPrefix,
  goBack,
  moveCursor,
  placeCursor,
  stateForValue,
  type NavState,
} from './navigation';
import { group, menu, option } from './test-fixtures';

// menu: pizza (0), drinks (1), bread (2), empty (3, a group without children).
// pizza: margherita, special (truffle, seafood), marinara.
// drinks: water, wine (disabled).

describe('placeCursor', () => {
  it('starts on the first enabled item of the first column', () => {
    expect(placeCursor(menu, EMPTY_NAV_STATE)).toEqual({ selected: [], highlighted: 0 });
  });

  it('starts on the selected option, in its column', () => {
    expect(placeCursor(menu, stateForValue(menu, 'seafood'))).toEqual({
      selected: [0, 1],
      highlighted: 1,
    });
  });

  it('starts in the column after a selected group', () => {
    expect(placeCursor(menu, { selected: [1], highlighted: null })).toEqual({
      selected: [1],
      highlighted: 0,
    });
  });

  it('keeps a cursor that is already there', () => {
    const state: NavState = { selected: [], highlighted: 2 };
    expect(placeCursor(menu, state)).toBe(state);
  });

  it('skips disabled items', () => {
    const roots = [option('a', { disabled: true }), group('g', []), option('b')];
    expect(placeCursor(roots, EMPTY_NAV_STATE).highlighted).toBe(2);
  });
});

describe('moveCursor', () => {
  const onPizza: NavState = { selected: [], highlighted: 0 };

  it('moves to the next and previous enabled item', () => {
    expect(moveCursor(menu, onPizza, 'next').highlighted).toBe(1);
    expect(
      moveCursor(menu, { selected: [], highlighted: 2 }, 'previous').highlighted,
    ).toBe(1);
  });

  it('skips disabled items and empty groups', () => {
    // After bread comes only the empty group: there is nothing further.
    const onBread: NavState = { selected: [], highlighted: 2 };
    expect(moveCursor(menu, onBread, 'next')).toBe(onBread);
    // Wine is disabled: from water there is nothing further.
    const onWater: NavState = { selected: [1], highlighted: 0 };
    expect(moveCursor(menu, onWater, 'next')).toBe(onWater);
  });

  it('does not wrap around', () => {
    expect(moveCursor(menu, onPizza, 'previous')).toBe(onPizza);
  });

  it('jumps to the first and the last enabled item', () => {
    expect(moveCursor(menu, onPizza, 'last').highlighted).toBe(2);
    expect(moveCursor(menu, { selected: [], highlighted: 2 }, 'first').highlighted).toBe(
      0,
    );
  });

  it('starts from an end when there is no cursor yet', () => {
    expect(moveCursor(menu, EMPTY_NAV_STATE, 'next').highlighted).toBe(0);
    expect(moveCursor(menu, EMPTY_NAV_STATE, 'previous').highlighted).toBe(2);
  });
});

describe('enterGroup and goBack', () => {
  it('enters a group on its first enabled item', () => {
    expect(enterGroup(menu, { selected: [], highlighted: 0 })).toEqual({
      selected: [0],
      highlighted: 0,
    });
  });

  it('does nothing on an option, without a cursor, or on an empty group', () => {
    const onBread: NavState = { selected: [], highlighted: 2 };
    expect(enterGroup(menu, onBread)).toBe(onBread);
    expect(enterGroup(menu, EMPTY_NAV_STATE)).toBe(EMPTY_NAV_STATE);
    const onEmpty: NavState = { selected: [], highlighted: 3 };
    expect(enterGroup(menu, onEmpty)).toBe(onEmpty);
  });

  it('goes back onto the group it came from', () => {
    expect(goBack({ selected: [0, 1], highlighted: 0 })).toEqual({
      selected: [0],
      highlighted: 1,
    });
  });

  it('does nothing in the first column', () => {
    const state: NavState = { selected: [], highlighted: 1 };
    expect(goBack(state)).toBe(state);
  });

  it('round-trips', () => {
    const start: NavState = { selected: [0], highlighted: 1 };
    expect(goBack(enterGroup(menu, start))).toEqual(start);
  });
});

describe('findByPrefix', () => {
  const roots = [
    option('Margherita'),
    option('Marinara'),
    option('Diavola'),
    option('Mushrooms', { disabled: true }),
    option('Capricciosa'),
  ];

  it('finds the next item with that initial, ignoring case', () => {
    expect(findByPrefix(roots, EMPTY_NAV_STATE, 'd').highlighted).toBe(2);
    expect(findByPrefix(roots, EMPTY_NAV_STATE, 'C').highlighted).toBe(4);
  });

  it('cycles through the items with the same initial, skipping disabled ones', () => {
    let state = findByPrefix(roots, EMPTY_NAV_STATE, 'm');
    expect(state.highlighted).toBe(0);
    state = findByPrefix(roots, state, 'm');
    expect(state.highlighted).toBe(1);
    state = findByPrefix(roots, state, 'm');
    expect(state.highlighted).toBe(0);
  });

  it('refines the match from the cursor with longer text', () => {
    const state = findByPrefix(roots, { selected: [], highlighted: 0 }, 'mari');
    expect(state.highlighted).toBe(1);
    expect(findByPrefix(roots, state, 'mar').highlighted).toBe(1);
  });

  it('does nothing when no label matches', () => {
    const state: NavState = { selected: [], highlighted: 2 };
    expect(findByPrefix(roots, state, 'z')).toBe(state);
  });
});
