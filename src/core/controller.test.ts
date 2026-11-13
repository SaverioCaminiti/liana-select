import { describe, expect, it, vi } from 'vitest';
import { LianaController, type ControllerOptions } from './controller';
import type { ColumnMetrics } from './scroll';
import { group, menu, option } from './test-fixtures';
import type { TreeNode } from './tree';

const ITEM_HEIGHT = 50;

interface Harness {
  readonly controller: LianaController;
  readonly commits: string[];
  /** Plays the part of the element: measures the drawn columns. */
  settle(): void;
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(): void;
  /** Labels of the active item of each column, with a marker for its state. */
  path(): string[];
}

function setup(
  roots: readonly TreeNode[],
  size: { width: number; height: number },
  options: Partial<ControllerOptions> = {},
): Harness {
  const controller = new LianaController({
    minContentWidth: 200,
    collapsedMinWidth: 40,
    hysteresis: 8,
    backtrackTravel: 24,
    ...options,
  });
  const commits: string[] = [];
  controller.onValueCommit = (value) => commits.push(value);

  const settle = (): void => {
    const metrics = new Map<string, ColumnMetrics>();
    for (const column of controller.view.columns) {
      metrics.set(column.key, {
        height: size.height,
        items: column.items.map((_, index) => ({
          top: index * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
        })),
      });
    }
    controller.setMetrics(metrics);
  };

  controller.setTree(roots);
  controller.setSize(size.width, size.height);
  settle();

  return {
    controller,
    commits,
    settle,
    down(x, y) {
      controller.pointerDown(x, y);
      settle();
    },
    move(x, y) {
      controller.pointerMove(x, y);
      settle();
    },
    up() {
      controller.pointerUp();
      settle();
    },
    path() {
      return controller.view.columns.map((column) => {
        const active = column.items.find((item) => item.state !== 'idle');
        if (active === undefined) return '-';
        return `${active.node.label}${active.state === 'selected' ? '!' : '?'}`;
      });
    },
  };
}

// 900 wide and 3 levels deep: three equal columns of 300, which never shrink.
// Items are 50 tall, so item n of a column is centred at y = 25 + 50 n.
const WIDE = { width: 900, height: 300 };

describe('LianaController, one continuous gesture', () => {
  it('goes down three levels and commits once, at release', () => {
    const h = setup(menu, WIDE);

    h.down(100, 25);
    expect(h.path()).toEqual(['pizza?', '-']);

    h.move(350, 75);
    expect(h.path()).toEqual(['pizza!', 'special?', '-']);

    h.move(650, 75);
    expect(h.path()).toEqual(['pizza!', 'special!', 'seafood?']);
    expect(h.controller.value).toBe('');
    expect(h.commits).toEqual([]);

    h.up();
    expect(h.path()).toEqual(['pizza!', 'special!', 'seafood!']);
    expect(h.controller.value).toBe('seafood');
    expect(h.commits).toEqual(['seafood']);
  });

  it('follows the pointer along a column, and the preview follows the highlight', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    h.move(100, 75);
    expect(h.path()).toEqual(['drinks?', '-']);
    h.move(100, 125);
    expect(h.path()).toEqual(['bread?']);
  });

  it('goes back to a column on the left and changes the choice there', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    h.move(350, 75);
    h.move(650, 25);
    expect(h.path()).toEqual(['pizza!', 'special!', 'truffle?']);

    h.move(100, 75);
    expect(h.path()).toEqual(['drinks?', '-']);

    h.move(350, 25);
    h.up();
    expect(h.controller.value).toBe('water');
    expect(h.commits).toEqual(['water']);
  });

  it('needs to cross the border by the hysteresis before changing column', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    h.move(305, 25);
    expect(h.path()).toEqual(['pizza?', '-']);
    h.move(310, 25);
    expect(h.path()).toEqual(['pizza!', 'margherita?']);
    h.move(295, 25);
    expect(h.path()).toEqual(['pizza!', 'margherita?']);
    h.move(290, 25);
    expect(h.path()).toEqual(['pizza?', '-']);
  });
});

describe('LianaController, one tap per level', () => {
  it('reaches the same value with three taps', () => {
    const h = setup(menu, WIDE);

    h.down(100, 25);
    h.up();
    expect(h.path()).toEqual(['pizza!', '-']);
    expect(h.commits).toEqual([]);

    h.down(350, 75);
    h.up();
    expect(h.path()).toEqual(['pizza!', 'special!', '-']);

    h.down(650, 75);
    h.up();
    expect(h.controller.value).toBe('seafood');
    expect(h.commits).toEqual(['seafood']);
  });

  it('restarts from the first column to undo a partial selection', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    h.up();
    h.down(350, 75);
    h.up();

    h.down(100, 125);
    h.up();
    expect(h.path()).toEqual(['bread!']);
    expect(h.controller.value).toBe('bread');
  });
});

describe('LianaController, value', () => {
  it('shows the whole path of a value set from outside, without committing', () => {
    const h = setup(menu, WIDE);
    h.controller.setValue('seafood');
    h.settle();
    expect(h.path()).toEqual(['pizza!', 'special!', 'seafood!']);
    expect(h.commits).toEqual([]);
  });

  it('clears the value when the gesture ends on a group', () => {
    const h = setup(menu, WIDE);
    h.controller.setValue('seafood');
    h.settle();

    h.down(100, 75);
    h.up();
    expect(h.path()).toEqual(['drinks!', '-']);
    expect(h.controller.value).toBe('');
    expect(h.commits).toEqual(['']);
  });

  it('commits nothing when the gesture ends on the same option', () => {
    const h = setup(menu, WIDE);
    h.controller.setValue('seafood');
    h.settle();

    h.down(650, 75);
    h.move(100, 75);
    h.move(100, 25);
    h.move(350, 75);
    h.move(650, 75);
    h.up();
    expect(h.controller.value).toBe('seafood');
    expect(h.commits).toEqual([]);
  });

  it('keeps the value when the tree is replaced and still has it', () => {
    const h = setup(menu, WIDE);
    h.controller.setValue('water');
    h.controller.setTree([option('water'), option('tea')]);
    expect(h.controller.value).toBe('water');
    h.controller.setTree([option('tea')]);
    expect(h.controller.value).toBe('');
  });
});

describe('LianaController, empty areas and borders', () => {
  it('highlights nothing over an empty area, and the preview disappears', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    expect(h.path()).toEqual(['pizza?', '-']);
    h.move(100, 250);
    expect(h.path()).toEqual(['-']);
    h.up();
    expect(h.path()).toEqual(['-']);
    expect(h.commits).toEqual([]);
  });

  it('does not highlight a group without children or a disabled option', () => {
    const h = setup(menu, WIDE);
    h.down(100, 175);
    expect(h.path()).toEqual(['-']);
    h.move(100, 75);
    h.move(350, 75);
    expect(h.path()).toEqual(['drinks!', '-']);
  });

  it('keeps an option highlighted when the pointer overshoots to the right', () => {
    const h = setup(menu, WIDE);
    h.down(100, 125);
    h.move(800, 125);
    expect(h.path()).toEqual(['bread?']);
    h.up();
    expect(h.controller.value).toBe('bread');
  });

  it('keeps following the pointer outside the component, along the border', () => {
    const h = setup(menu, WIDE);
    h.down(100, 25);
    h.move(-200, 75);
    expect(h.path()).toEqual(['drinks?', '-']);
    h.move(100, -500);
    expect(h.path()).toEqual(['pizza?', '-']);
    h.move(2000, 25);
    expect(h.path()).toEqual(['pizza!', 'margherita?']);
  });

  it('ignores moves and releases when no gesture is in progress', () => {
    const h = setup(menu, WIDE);
    h.move(100, 25);
    h.up();
    expect(h.path()).toEqual(['-']);
    expect(h.commits).toEqual([]);
  });
});

describe('LianaController, cancel', () => {
  it('restores the state the gesture started from', () => {
    const h = setup(menu, WIDE);
    h.controller.setValue('seafood');
    h.settle();

    h.down(100, 75);
    h.move(350, 25);
    expect(h.path()).toEqual(['drinks!', 'water?']);

    h.controller.pointerCancel();
    expect(h.path()).toEqual(['pizza!', 'special!', 'seafood!']);
    expect(h.controller.value).toBe('seafood');
    expect(h.commits).toEqual([]);
  });
});

describe('LianaController, vertical scroll', () => {
  // Eight items of 50 in a column 200 tall: 200 of overflow.
  const long = [
    ...Array.from({ length: 7 }, (_, index) => option(`item${String(index)}`)),
    group('more', [option('deep')]),
  ];
  const SHORT = { width: 600, height: 200 };

  function scrollOf(h: Harness, column: number): number {
    return h.controller.view.columns[column]?.scroll ?? -1;
  }

  it('does not jump at press: the item under the pointer is the one that was there', () => {
    const h = setup(long, SHORT);
    h.down(100, 125);
    expect(scrollOf(h, 0)).toBe(0);
    expect(h.path()).toEqual(['item2?']);
  });

  it('reaches the first and the last item without lifting the pointer', () => {
    const h = setup(long, SHORT);
    h.down(100, 100);
    h.move(100, 175);
    expect(scrollOf(h, 0)).toBe(200);
    expect(h.path()).toEqual(['more?', '-']);
    h.move(100, 25);
    expect(scrollOf(h, 0)).toBe(0);
    expect(h.path()).toEqual(['item0?']);
  });

  it('keeps the offset between gestures and anchors the next one to it', () => {
    const h = setup(long, SHORT);
    h.down(100, 100);
    h.move(100, 175);
    h.move(100, 150);
    h.up();
    const resting = scrollOf(h, 0);
    expect(resting).toBeGreaterThan(0);

    h.down(100, 60);
    expect(scrollOf(h, 0)).toBe(resting);
  });

  it('scrolls a selected value into view', () => {
    const h = setup(long, SHORT);
    h.controller.setValue('item6');
    h.settle();
    // item6 spans 300-350: the smallest offset that shows it all is 150.
    expect(scrollOf(h, 0)).toBe(150);
    expect(h.path()).toEqual(['item6!']);
  });

  it('starts a new column from the top and anchors it where the pointer enters', () => {
    const h = setup(long, SHORT);
    h.down(100, 100);
    h.move(100, 175);
    h.move(350, 175);
    expect(scrollOf(h, 1)).toBe(0);
    expect(h.path()).toEqual(['more!', '-']);
  });
});

describe('LianaController, shrinking layout', () => {
  // A chain six levels deep: every level has one group and one option.
  function chain(level: number): TreeNode[] {
    const leaf = option(`leaf${String(level)}`);
    return level === 5
      ? [leaf]
      : [group(`level${String(level)}`, chain(level + 1)), leaf];
  }
  // 400 wide for six levels: equal parts would be 66, below the minimum of 200.
  const NARROW = { width: 400, height: 300 };

  function widths(h: Harness): number[] {
    return h.controller.view.columns.map((column) => column.width);
  }

  /** Goes down `levels` levels with one tap each, on the group at the top. */
  function descend(h: Harness, levels: number): void {
    for (let level = 0; level < levels; level++) {
      const current = h.controller.view.columns.find(
        (column) => column.role === 'current',
      );
      h.down((current?.x ?? 0) + 10, 25);
      h.up();
    }
  }

  it('keeps the current column whole while the left ones shrink', () => {
    const h = setup(chain(0), NARROW);
    expect(widths(h)).toEqual([200]);
    descend(h, 3);
    expect(widths(h)).toEqual([40, 40, 40, 200]);
    descend(h, 1);
    expect(widths(h)).toEqual([0, 40, 40, 40, 200]);
  });

  it('does not open the levels in a cascade when the layout moves under the pointer', () => {
    const h = setup(chain(0), NARROW);
    h.down(100, 25);
    // Entering the preview moves the columns: the pointer is now to the right of
    // the column it has just entered, over the next preview.
    h.move(260, 25);
    expect(h.path()).toEqual(['level0!', 'level1?', '-']);
    h.move(270, 25);
    h.move(390, 25);
    expect(h.path()).toEqual(['level0!', 'level1?', '-']);
    // It still chooses within that column by height.
    h.move(390, 75);
    expect(h.path()).toEqual(['level0!', 'leaf1?']);
  });

  it('goes one level deeper after coming back inside the current column', () => {
    const h = setup(chain(0), NARROW);
    h.down(100, 25);
    h.move(260, 25);
    h.move(150, 25);
    h.move(300, 25);
    expect(h.path()).toEqual(['level0!', 'level1!', 'level2?', '-']);
  });

  it('goes back one column at a time while sliding left over shrunk columns', () => {
    const h = setup(chain(0), NARROW);
    descend(h, 4);
    // Columns: hidden, three strips of 40, then the current one from 120 to 320.
    h.down(200, 25);
    expect(h.path()).toEqual([
      'level0!',
      'level1!',
      'level2!',
      'level3!',
      'level4?',
      '-',
    ]);

    h.move(100, 25);
    expect(h.path().length).toBe(5);
    expect(h.path().at(-2)).toBe('level3?');

    // A little further left is not enough to go back again...
    h.move(90, 25);
    expect(h.path().at(-2)).toBe('level3?');
    // ...a clear movement is, and it goes back exactly one column.
    h.move(70, 25);
    expect(h.path().at(-2)).toBe('level2?');

    h.move(0, 25);
    h.move(0, 26);
    h.move(0, 27);
    expect(h.path()).toEqual(['level0?', '-']);
  });
});

describe('LianaController, notifications', () => {
  it('notifies view changes, but not for measurements that did not change', () => {
    const h = setup(menu, WIDE);
    const listener = vi.fn();
    h.controller.onViewChange = listener;
    h.settle();
    expect(listener).not.toHaveBeenCalled();
    h.down(100, 25);
    expect(listener).toHaveBeenCalled();
  });
});
