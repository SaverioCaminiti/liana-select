/**
 * Tree model used by the core.
 *
 * The element builds it from the `<liana-group>` / `<liana-option>` markup; the
 * core never looks at the DOM.
 */

/** A leaf: choosing it sets the value of the component. */
export interface OptionNode {
  readonly kind: 'option';
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** A category: choosing it opens the column with its children. */
export interface GroupNode {
  readonly kind: 'group';
  readonly label: string;
  readonly disabled?: boolean;
  readonly children: readonly TreeNode[];
}

export type TreeNode = OptionNode | GroupNode;

/** Position of a node in the tree, as the index of the child taken at each level. */
export type NodePath = readonly number[];

/**
 * Whether the node can be highlighted and selected. A group without children
 * leads nowhere, so it counts as disabled.
 */
export function isEnabled(node: TreeNode): boolean {
  if (node.disabled === true) return false;
  return node.kind === 'option' || node.children.length > 0;
}

/**
 * Returns the children of the node at `parentPath`, the roots for the empty
 * path, or `undefined` if the path does not lead to a group.
 */
export function getChildrenAt(
  roots: readonly TreeNode[],
  parentPath: NodePath,
): readonly TreeNode[] | undefined {
  let level: readonly TreeNode[] = roots;
  for (const index of parentPath) {
    const node = level[index];
    if (node?.kind !== 'group') return undefined;
    level = node.children;
  }
  return level;
}

/** Returns the node at `path`, or `undefined` if the path does not exist. */
export function getNodeAtPath(
  roots: readonly TreeNode[],
  path: NodePath,
): TreeNode | undefined {
  const index = path.at(-1);
  if (index === undefined) return undefined;
  return getChildrenAt(roots, path.slice(0, -1))?.[index];
}

/** Returns the path of the first option with the given value (depth-first). */
export function findPathByValue(
  roots: readonly TreeNode[],
  value: string,
): NodePath | undefined {
  for (const [index, node] of roots.entries()) {
    if (node.kind === 'option') {
      if (node.value === value) return [index];
    } else {
      const childPath = findPathByValue(node.children, value);
      if (childPath !== undefined) return [index, ...childPath];
    }
  }
  return undefined;
}

/** Number of levels of the deepest branch: 0 for an empty tree, 1 for a flat list. */
export function treeDepth(roots: readonly TreeNode[]): number {
  let depth = 0;
  for (const node of roots) {
    const below = node.kind === 'group' ? treeDepth(node.children) : 0;
    depth = Math.max(depth, 1 + below);
  }
  return depth;
}
