import { describe, expect, it } from 'vitest';
import { findPathById, getNodeAtPath, isLeaf, type TreeNode } from './tree';

const fruit: TreeNode = {
  id: 'fruit',
  label: 'Fruit',
  children: [
    { id: 'apple', label: 'Apple' },
    {
      id: 'citrus',
      label: 'Citrus',
      children: [
        { id: 'lemon', label: 'Lemon' },
        { id: 'orange', label: 'Orange' },
      ],
    },
  ],
};

const tree: readonly TreeNode[] = [
  fruit,
  { id: 'empty', label: 'Empty category', children: [] },
];

describe('isLeaf', () => {
  it('is true for a node without children', () => {
    expect(isLeaf({ id: 'a', label: 'A' })).toBe(true);
  });

  it('is true for a node with an empty children list', () => {
    expect(isLeaf({ id: 'a', label: 'A', children: [] })).toBe(true);
  });

  it('is false for a node with children', () => {
    expect(isLeaf(fruit)).toBe(false);
  });
});

describe('getNodeAtPath', () => {
  it('returns a root node', () => {
    expect(getNodeAtPath(tree, [1])?.id).toBe('empty');
  });

  it('returns a deeply nested node', () => {
    expect(getNodeAtPath(tree, [0, 1, 1])?.id).toBe('orange');
  });

  it('returns undefined for the empty path', () => {
    expect(getNodeAtPath(tree, [])).toBeUndefined();
  });

  it('returns undefined when an index is out of range', () => {
    expect(getNodeAtPath(tree, [0, 5])).toBeUndefined();
  });

  it('returns undefined when the path goes below a leaf', () => {
    expect(getNodeAtPath(tree, [0, 0, 0])).toBeUndefined();
  });
});

describe('findPathById', () => {
  it('finds a nested node', () => {
    expect(findPathById(tree, 'lemon')).toEqual([0, 1, 0]);
  });

  it('finds a root node', () => {
    expect(findPathById(tree, 'empty')).toEqual([1]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findPathById(tree, 'banana')).toBeUndefined();
  });

  it('is the inverse of getNodeAtPath', () => {
    const path = findPathById(tree, 'orange') ?? [];
    expect(getNodeAtPath(tree, path)?.id).toBe('orange');
  });
});
