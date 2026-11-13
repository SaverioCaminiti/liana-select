import type { TreeNode } from '../core/index';
import { collapseWhitespace } from './liana-option';

export interface MarkupTree {
  readonly roots: TreeNode[];
  /** Value of the last option marked `selected`, as in a native `<select>`. */
  readonly selectedValue: string | undefined;
}

/**
 * Builds the tree from the `<liana-group>` and `<liana-option>` children of
 * `host`. It reads tag names and attributes only, so it does not depend on the
 * child elements having been upgraded. Other children are ignored.
 */
export function readTree(host: Element): MarkupTree {
  let selectedValue: string | undefined;

  const readChildren = (parent: Element): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const child of parent.children) {
      const disabled = child.hasAttribute('disabled');
      if (child.localName === 'liana-group') {
        nodes.push({
          kind: 'group',
          label: child.getAttribute('label') ?? '',
          disabled,
          children: readChildren(child),
        });
      } else if (child.localName === 'liana-option') {
        const label =
          child.getAttribute('label') ?? collapseWhitespace(child.textContent);
        const value = child.getAttribute('value') ?? label;
        if (child.hasAttribute('selected')) selectedValue = value;
        nodes.push({ kind: 'option', value, label, disabled });
      }
    }
    return nodes;
  };

  const roots = readChildren(host);
  return { roots, selectedValue };
}
