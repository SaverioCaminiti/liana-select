/**
 * Internal tree model used by the core.
 *
 * This is NOT the public input format of <liana-select>, which is still to be
 * designed. It is the minimal shape the navigation logic needs, and the public
 * format will be converted into it.
 */
export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly children?: readonly TreeNode[];
}

/** Position of a node in the tree, as the index of the child taken at each level. */
export type NodePath = readonly number[];

/** A leaf is a node that can be selected: it has no children. */
export function isLeaf(node: TreeNode): boolean {
  return node.children === undefined || node.children.length === 0;
}

/** Returns the node at `path`, or `undefined` if the path does not exist. */
export function getNodeAtPath(
  roots: readonly TreeNode[],
  path: NodePath,
): TreeNode | undefined {
  let level: readonly TreeNode[] | undefined = roots;
  let node: TreeNode | undefined;
  for (const index of path) {
    node = level?.[index];
    if (node === undefined) return undefined;
    level = node.children;
  }
  return node;
}

/** Returns the path of the first node with the given id (depth-first), or `undefined`. */
export function findPathById(
  roots: readonly TreeNode[],
  id: string,
): NodePath | undefined {
  for (const [index, node] of roots.entries()) {
    if (node.id === id) return [index];
    if (node.children !== undefined) {
      const childPath = findPathById(node.children, id);
      if (childPath !== undefined) return [index, ...childPath];
    }
  }
  return undefined;
}
