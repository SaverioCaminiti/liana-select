import { describe, expect, it } from 'vitest';
import { group, menu, option } from './test-fixtures';
import {
  findPathByValue,
  getChildrenAt,
  getNodeAtPath,
  isEnabled,
  treeDepth,
} from './tree';

describe('isEnabled', () => {
  it('is true for a plain option and for a group with children', () => {
    expect(isEnabled(option('a'))).toBe(true);
    expect(isEnabled(group('g', [option('a')]))).toBe(true);
  });

  it('is false for disabled nodes', () => {
    expect(isEnabled(option('a', { disabled: true }))).toBe(false);
    expect(isEnabled(group('g', [option('a')], { disabled: true }))).toBe(false);
  });

  it('is false for a group without children', () => {
    expect(isEnabled(group('g', []))).toBe(false);
  });
});

describe('getChildrenAt', () => {
  it('returns the roots for the empty path', () => {
    expect(getChildrenAt(menu, [])).toBe(menu);
  });

  it('returns the children of a nested group', () => {
    expect(getChildrenAt(menu, [0, 1])?.map((node) => node.label)).toEqual([
      'truffle',
      'seafood',
    ]);
  });

  it('returns undefined when the path leads to an option or nowhere', () => {
    expect(getChildrenAt(menu, [2])).toBeUndefined();
    expect(getChildrenAt(menu, [9])).toBeUndefined();
    expect(getChildrenAt(menu, [0, 0, 0])).toBeUndefined();
  });
});

describe('getNodeAtPath', () => {
  it('returns root and nested nodes', () => {
    expect(getNodeAtPath(menu, [2])?.label).toBe('bread');
    expect(getNodeAtPath(menu, [0, 1, 1])?.label).toBe('seafood');
  });

  it('returns undefined for the empty path and for missing nodes', () => {
    expect(getNodeAtPath(menu, [])).toBeUndefined();
    expect(getNodeAtPath(menu, [0, 5])).toBeUndefined();
    expect(getNodeAtPath(menu, [2, 0])).toBeUndefined();
  });
});

describe('findPathByValue', () => {
  it('finds root and nested options', () => {
    expect(findPathByValue(menu, 'bread')).toEqual([2]);
    expect(findPathByValue(menu, 'seafood')).toEqual([0, 1, 1]);
  });

  it('does not match group labels', () => {
    expect(findPathByValue(menu, 'pizza')).toBeUndefined();
  });

  it('returns undefined for an unknown value', () => {
    expect(findPathByValue(menu, 'sushi')).toBeUndefined();
  });

  it('is the inverse of getNodeAtPath', () => {
    const path = findPathByValue(menu, 'water') ?? [];
    expect(getNodeAtPath(menu, path)).toEqual(option('water'));
  });
});

describe('treeDepth', () => {
  it('is 0 for an empty tree and 1 for a flat list', () => {
    expect(treeDepth([])).toBe(0);
    expect(treeDepth([option('a'), option('b')])).toBe(1);
  });

  it('counts the levels of the deepest branch', () => {
    expect(treeDepth(menu)).toBe(3);
  });

  it('counts an empty group as one level', () => {
    expect(treeDepth([group('g', [])])).toBe(1);
  });
});
