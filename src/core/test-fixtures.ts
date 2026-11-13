import type { GroupNode, OptionNode, TreeNode } from './tree';

export function option(value: string, extra: Partial<OptionNode> = {}): OptionNode {
  return { kind: 'option', value, label: value, ...extra };
}

export function group(
  label: string,
  children: readonly TreeNode[],
  extra: Partial<GroupNode> = {},
): GroupNode {
  return { kind: 'group', label, children, ...extra };
}

/**
 * A small restaurant menu, three levels deep.
 *
 * 0 pizza ─┬─ 0 margherita
 *          ├─ 1 special ─┬─ 0 truffle
 *          │             └─ 1 seafood
 *          └─ 2 marinara
 * 1 drinks ─┬─ 0 water
 *           └─ 1 wine (disabled)
 * 2 bread
 * 3 empty (group without children)
 */
export const menu: readonly TreeNode[] = [
  group('pizza', [
    option('margherita'),
    group('special', [option('truffle'), option('seafood')]),
    option('marinara'),
  ]),
  group('drinks', [option('water'), option('wine', { disabled: true })]),
  option('bread'),
  group('empty', []),
];
