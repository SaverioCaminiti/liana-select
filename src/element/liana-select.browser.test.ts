import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../index';
import type { LianaSelect } from './liana-select';

/**
 * A 900 x 300 select with three levels: three equal columns of 300 that never
 * shrink. A column with three items has rows 100 tall, centred at 50, 150, 250.
 *
 *   Pizza ─┬─ Margherita
 *          ├─ Special ─┬─ Truffle
 *          │           ├─ Seafood
 *          │           └─ Four cheeses
 *          └─ Marinara
 *   Drinks ─┬─ Water
 *           ├─ Wine (disabled)
 *           └─ Beer
 *   Bread
 */
const MARKUP = `
  <form>
    <button type="button" id="before">Before</button>
    <liana-select name="dish" style="width: 900px; height: 300px; border: 0">
      <liana-group label="Pizza">
        <liana-option value="margherita">Margherita</liana-option>
        <liana-group label="Special">
          <liana-option value="truffle">Truffle</liana-option>
          <liana-option value="seafood">Seafood</liana-option>
          <liana-option value="four-cheeses">Four cheeses</liana-option>
        </liana-group>
        <liana-option value="marinara">Marinara</liana-option>
      </liana-group>
      <liana-group label="Drinks">
        <liana-option value="water">Water</liana-option>
        <liana-option value="wine" disabled>Wine</liana-option>
        <liana-option value="beer">Beer</liana-option>
      </liana-group>
      <liana-option value="bread">Bread</liana-option>
    </liana-select>
    <button type="button" id="after">After</button>
  </form>
`;

let form: HTMLFormElement;
let select: LianaSelect;
let events: string[];

function find<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const element = document.querySelector(tag);
  if (element === null) throw new Error(`Missing <${tag}> in the test markup`);
  return element;
}

/** Waits for the element to draw, measure itself and draw again. */
async function settled(): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    await select.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** The active item of each column: `Label!` if selected, `Label?` if highlighted. */
function path(): string[] {
  const columns = select.shadowRoot?.querySelectorAll('.column') ?? [];
  return Array.from(columns, (column) => {
    const active = column.querySelector<HTMLElement>('.item:not([data-state="idle"])');
    if (active === null) return '-';
    const mark = active.dataset.state === 'selected' ? '!' : '?';
    return `${active.textContent.trim()}${mark}`;
  });
}

async function tap(x: number, y: number): Promise<void> {
  await userEvent.click(select, { position: { x, y } });
  await settled();
}

async function drag(from: [number, number], to: [number, number]): Promise<void> {
  await userEvent.dragAndDrop(select, select, {
    sourcePosition: { x: from[0], y: from[1] },
    targetPosition: { x: to[0], y: to[1] },
    steps: 20,
  });
  await settled();
}

beforeEach(async () => {
  document.body.innerHTML = MARKUP;
  form = find('form');
  select = find('liana-select');
  events = [];
  for (const type of ['input', 'change']) {
    select.addEventListener(type, () => events.push(`${type}:${select.value}`));
  }
  await settled();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<liana-select> markup', () => {
  it('draws the first level only, and hides its light DOM children', () => {
    expect(path()).toEqual(['-']);
    const items = select.shadowRoot?.querySelectorAll('.item') ?? [];
    expect(Array.from(items, (item) => item.textContent.trim())).toEqual([
      'Pizza',
      'Drinks',
      'Bread',
    ]);
    expect(select.querySelector('liana-group')?.getBoundingClientRect().height).toBe(0);
  });

  it('opens the whole path of the option marked as selected', async () => {
    select.querySelector('[value="seafood"]')?.setAttribute('selected', '');
    await settled();
    expect(select.value).toBe('seafood');
    expect(path()).toEqual(['Pizza!', 'Special!', 'Seafood!']);
    expect(events).toEqual([]);
  });

  it('follows changes to its children', async () => {
    select.value = 'bread';
    select.querySelector('[value="bread"]')?.remove();
    await settled();
    expect(select.value).toBe('');

    const soup = document.createElement('liana-option');
    soup.value = 'soup';
    soup.textContent = 'Soup';
    select.append(soup);
    await settled();
    const items = select.shadowRoot?.querySelectorAll('.column:first-child .item') ?? [];
    expect(items.length).toBe(3);
    expect(items[2]?.textContent.trim()).toBe('Soup');
  });

  it('remembers a value set before its option exists', async () => {
    select.value = 'soup';
    expect(select.value).toBe('');
    const soup = document.createElement('liana-option');
    soup.value = 'soup';
    soup.textContent = 'Soup';
    select.append(soup);
    await settled();
    expect(select.value).toBe('soup');
  });
});

describe('<liana-select> gesture', () => {
  it('selects an option three levels down with one continuous gesture', async () => {
    // From Pizza (first row) straight to Seafood (middle row of the third column).
    await drag([150, 50], [750, 150]);
    expect(path()).toEqual(['Pizza!', 'Special!', 'Seafood!']);
    expect(select.value).toBe('seafood');
    expect(events).toEqual(['input:seafood', 'change:seafood']);
  });

  it('selects the same option with one tap per level', async () => {
    await tap(150, 50);
    expect(path()).toEqual(['Pizza!', '-']);
    expect(events).toEqual([]);

    await tap(450, 150);
    expect(path()).toEqual(['Pizza!', 'Special!', '-']);

    await tap(750, 150);
    expect(select.value).toBe('seafood');
    expect(events).toEqual(['input:seafood', 'change:seafood']);
  });

  it('goes back to an earlier column to change the choice', async () => {
    await drag([150, 50], [750, 150]);
    events.length = 0;

    // Start again from the third column and slide back to Drinks, then Water.
    await drag([750, 150], [150, 150]);
    expect(path()).toEqual(['Drinks!', '-']);
    expect(select.value).toBe('');
    expect(events).toEqual(['input:', 'change:']);

    await tap(450, 50);
    expect(select.value).toBe('water');
  });

  it('dispatches nothing when the gesture ends on the same option', async () => {
    await drag([150, 50], [750, 150]);
    events.length = 0;
    await tap(750, 150);
    expect(select.value).toBe('seafood');
    expect(events).toEqual([]);
  });

  it('does not select disabled options', async () => {
    await tap(150, 150);
    await tap(450, 150);
    expect(path()).toEqual(['Drinks!', '-']);
    expect(select.value).toBe('');
  });

  it('ignores the pointer when disabled', async () => {
    select.disabled = true;
    await settled();
    await userEvent.click(select, { position: { x: 150, y: 250 }, force: true });
    await settled();
    expect(select.value).toBe('');
    expect(path()).toEqual(['-']);
  });
});

describe('<liana-select> with a deep tree in a narrow space', () => {
  // As in the documentation: too narrow for one column per level, so entering
  // a column moves the layout under the pointer.
  const GEO = `
    <liana-select style="width: 352px; height: 300px; border: 0">
      <liana-group label="Europe">
        <liana-group label="Italy">
          <liana-group label="Lazio">
            <liana-option value="rome">Rome</liana-option>
            <liana-option value="viterbo">Viterbo</liana-option>
          </liana-group>
          <liana-group label="Tuscany">
            <liana-option value="florence">Florence</liana-option>
          </liana-group>
        </liana-group>
      </liana-group>
      <liana-group label="Asia">
        <liana-group label="Japan">
          <liana-group label="Kansai">
            <liana-option value="kyoto">Kyoto</liana-option>
          </liana-group>
        </liana-group>
      </liana-group>
    </liana-select>
  `;

  it('reaches the option under the pointer in one slide to the right', async () => {
    document.body.innerHTML = GEO;
    select = find('liana-select');
    await settled();

    // Europe, Italy, Lazio and Rome are all first in their column.
    await drag([40, 20], [330, 20]);
    expect(path()).toEqual(['Europe!', 'Italy!', 'Lazio!', 'Rome!']);
    expect(select.value).toBe('rome');
  });
});

describe('<liana-select> with fractional sizes', () => {
  // Regression: a height that is not a whole number of pixels made the column
  // look overflowing by a fraction of a pixel, and the measure / scroll / draw
  // cycle never settled, freezing the page.
  it.each([300.4, 420.4, 297.37, 243.9])(
    'stays responsive at a height of %fpx',
    async (height) => {
      select.style.height = `${String(height)}px`;
      await settled();

      await drag([150, 5], [150, height - 5]);
      await drag([150, height / 2], [750, height / 3]);
      await tap(150, height * 0.4);
      await tap(450, height * 0.6);

      // Reaching this point at all means the page did not freeze.
      const scrolled = Array.from(
        select.shadowRoot?.querySelectorAll<HTMLElement>('.content') ?? [],
        (content) => content.style.transform,
      );
      expect(scrolled.every((transform) => transform === 'translateY(0px)')).toBe(true);
    },
  );
});

describe('<liana-select> with the keyboard', () => {
  /** Focuses the button before the select, then tabs into the select. */
  async function tabIn(): Promise<void> {
    document.querySelector<HTMLElement>('#before')?.focus();
    await userEvent.tab();
    await settled();
  }

  async function press(...keys: string[]): Promise<void> {
    for (const key of keys) await userEvent.keyboard(`{${key}}`);
    await settled();
  }

  function tree(): HTMLElement {
    const element = select.shadowRoot?.querySelector<HTMLElement>('[role="tree"]');
    if (element == null) throw new Error('No tree in the shadow root');
    return element;
  }

  it('is one tab stop, and shows the cursor when reached with Tab', async () => {
    await tabIn();
    expect(document.activeElement).toBe(select);
    expect(select.shadowRoot?.activeElement).toBe(tree());
    expect(select.matches(':state(focus-visible)')).toBe(true);
    expect(path()).toEqual(['Pizza?', '-']);
    expect(tree().getAttribute('aria-activedescendant')).toBe('item-0');

    await userEvent.tab();
    expect(document.activeElement?.id).toBe('after');
    expect(select.matches(':state(focus-visible)')).toBe(false);
  });

  it('navigates and commits once, on Enter', async () => {
    await tabIn();
    await press('ArrowRight', 'ArrowDown');
    expect(path()).toEqual(['Pizza!', 'Special?', '-']);
    await press('ArrowRight', 'ArrowDown');
    expect(path()).toEqual(['Pizza!', 'Special!', 'Seafood?']);
    expect(select.value).toBe('');
    expect(events).toEqual([]);

    await press('Enter');
    expect(select.value).toBe('seafood');
    expect(new FormData(form).get('dish')).toBe('seafood');
    expect(events).toEqual(['input:seafood', 'change:seafood']);
  });

  it('commits with Space too, and searches by the first letters', async () => {
    await tabIn();
    await userEvent.keyboard('b');
    await settled();
    expect(path()).toEqual(['Bread?']);
    // A space right after a letter is part of the search: wait for it to end.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await press(' ');
    expect(select.value).toBe('bread');
  });

  it('restores the selection on Escape', async () => {
    select.value = 'seafood';
    await tabIn();
    expect(path()).toEqual(['Pizza!', 'Special!', 'Seafood?']);
    await press('ArrowLeft', 'ArrowLeft', 'ArrowDown');
    expect(path()).toEqual(['Drinks?', '-']);
    await press('Escape');
    expect(path()).toEqual(['Pizza!', 'Special!', 'Seafood!']);
    expect(select.value).toBe('seafood');
    expect(events).toEqual([]);
  });

  it('restores the selection when the focus moves on without confirming', async () => {
    await tabIn();
    await press('ArrowDown', 'ArrowRight');
    await userEvent.tab();
    await settled();
    expect(path()).toEqual(['-']);
    expect(events).toEqual([]);
  });

  it('cannot be reached when disabled', async () => {
    select.disabled = true;
    await settled();
    await tabIn();
    expect(document.activeElement?.id).toBe('after');
  });

  it('exposes a tree to assistive technology', async () => {
    await tabIn();
    await press('ArrowRight');
    const items = Array.from(
      select.shadowRoot?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    );
    const describe = (item: HTMLElement | undefined): Record<string, string | null> => ({
      label: item?.textContent.trim() ?? null,
      level: item?.getAttribute('aria-level') ?? null,
      position: `${item?.getAttribute('aria-posinset') ?? '?'}/${item?.getAttribute('aria-setsize') ?? '?'}`,
      expanded: item?.getAttribute('aria-expanded') ?? null,
    });
    expect(describe(items[0])).toEqual({
      label: 'Pizza',
      level: '1',
      position: '1/3',
      expanded: 'true',
    });
    expect(describe(items[2])).toEqual({
      label: 'Bread',
      level: '1',
      position: '3/3',
      expanded: null,
    });
    expect(describe(items[4])).toEqual({
      label: 'Special',
      level: '2',
      position: '2/3',
      expanded: 'false',
    });
    expect(tree().getAttribute('aria-activedescendant')).toBe('item-0-0');
    // The disabled option is announced as such.
    await press('ArrowLeft', 'ArrowDown', 'ArrowRight');
    const wine = select.shadowRoot?.querySelector('[role="treeitem"][id="item-1-1"]');
    expect(wine?.getAttribute('aria-disabled')).toBe('true');
  });

  it('takes its accessible name from aria-label or from its label', async () => {
    select.id = 'dish';
    const label = document.createElement('label');
    label.htmlFor = 'dish';
    label.textContent = 'Your dish';
    form.prepend(label);
    select.requestUpdate();
    await settled();
    expect(tree().getAttribute('aria-label')).toBe('Your dish');

    select.setAttribute('aria-label', 'Dish of the day');
    await settled();
    expect(tree().getAttribute('aria-label')).toBe('Dish of the day');
  });
});

describe('<liana-select> colours', () => {
  function item(label: string): Element | undefined {
    return Array.from(select.shadowRoot?.querySelectorAll('.item') ?? []).find(
      (element) => element.textContent.trim() === label,
    );
  }

  function colours(label: string): { background: string; text: string } {
    const element = item(label);
    if (element === undefined) return { background: '', text: '' };
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  }

  /** The colour a CSS colour value computes to, with the colour scheme of the select. */
  function computed(value: string): string {
    const probe = document.createElement('div');
    probe.style.colorScheme = 'light dark';
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }

  /** Tabs into the select from the button before it: the cursor is on Pizza. */
  async function tabIn(): Promise<void> {
    document.querySelector<HTMLElement>('#before')?.focus();
    await userEvent.tab();
    await settled();
  }

  /**
   * The colour each engine names for its focus ring: `-webkit-focus-ring-color`
   * in Chromium and WebKit, the system `AccentColor` in Firefox, which draws its
   * ring with it.
   */
  function browserRing(): string {
    const probe = document.createElement('div');
    if (CSS.supports('outline-color', '-webkit-focus-ring-color')) {
      probe.style.outlineColor = '-webkit-focus-ring-color';
      document.body.append(probe);
      const colour = getComputedStyle(probe).outlineColor;
      probe.remove();
      return colour;
    }
    return computed('AccentColor');
  }

  it('highlights with the colour of the browser focus ring, lightened', async () => {
    const ring = browserRing();
    await tabIn();
    expect(path()).toEqual(['Pizza?', '-']);
    // Half the ring colour, half the background of the field.
    expect(colours('Pizza').background).toBe(
      computed(`color-mix(in srgb, ${ring} 50%, Field)`),
    );
    // The focus ring itself is the browser's colour, unmixed.
    expect(getComputedStyle(select).outlineColor).toBe(ring);
  });

  it('matches the focus ring of a button, where the engine reports it', async () => {
    // Only Chromium reports the colour it draws the ring with; Firefox and
    // WebKit report the text colour for a ring drawn by the system.
    if (!navigator.userAgent.includes('Chrome/')) return;
    document.querySelector<HTMLElement>('#before')?.focus();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    const focused = document.activeElement;
    if (focused === null) throw new Error('Nothing is focused');
    expect(focused.id).toBe('before');
    expect(getComputedStyle(focused).outlineColor).toBe(browserRing());
  });

  it('shows selected items in a lighter tint of the same colour', async () => {
    select.style.setProperty('--liana-accent-color', 'rgb(0, 0, 200)');
    await tap(150, 50);
    expect(path()).toEqual(['Pizza!', '-']);
    const { background, text } = colours('Pizza');
    expect(background).not.toBe('rgb(0, 0, 200)');
    expect(background).toMatch(/^color\(srgb /);
    // Selected items keep the normal text colour.
    expect(text).toBe(getComputedStyle(select).color);
  });

  it('derives the highlight from the accent colour', async () => {
    select.style.setProperty('--liana-accent-color', 'rgb(0, 0, 200)');
    await tabIn();
    expect(colours('Pizza').background).toBe(
      computed('color-mix(in srgb, rgb(0, 0, 200) 50%, Field)'),
    );
  });

  it('picks a readable text colour for the highlighted item', async () => {
    select.style.setProperty('--liana-highlight-color', 'rgb(20, 20, 120)');
    await tabIn();
    expect(colours('Pizza')).toEqual({
      background: 'rgb(20, 20, 120)',
      text: 'rgb(255, 255, 255)',
    });

    select.style.setProperty('--liana-highlight-color', 'rgb(250, 230, 120)');
    select.blur();
    await tabIn();
    expect(colours('Pizza')).toEqual({
      background: 'rgb(250, 230, 120)',
      text: 'rgb(0, 0, 0)',
    });
  });
});

describe('<liana-select> trail', () => {
  function canvas(): HTMLCanvasElement {
    const element = select.shadowRoot?.querySelector('canvas');
    if (element == null) throw new Error('No trail canvas');
    return element;
  }

  /** How many pixels of the trail canvas are painted, and the colour of the most opaque. */
  function painted(): { count: number; colour: [number, number, number] | null } {
    const element = canvas();
    const context = element.getContext('2d');
    if (context === null || element.width === 0) return { count: 0, colour: null };
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let count = 0;
    let colour: [number, number, number] | null = null;
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) {
      const alpha = data[index] ?? 0;
      if (alpha === 0) continue;
      count += 1;
      if (alpha > opaque) {
        opaque = alpha;
        colour = [data[index - 3] ?? 0, data[index - 2] ?? 0, data[index - 1] ?? 0];
      }
    }
    return { count, colour };
  }

  /** Slides a pointer of the given type across the first column, leaving it pressed. */
  async function slide(pointerType: 'touch' | 'mouse' | 'pen'): Promise<void> {
    const tree = select.shadowRoot?.querySelector<HTMLElement>('[role="tree"]');
    if (tree == null) throw new Error('No tree');
    const fire = (type: string, x: number, y: number): void => {
      const rect = tree.getBoundingClientRect();
      tree.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 21,
          pointerType,
          isPrimary: true,
          button: 0,
          bubbles: true,
          composed: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
        }),
      );
    };
    fire('pointerdown', 40, 30);
    for (let y = 30; y <= 270; y += 20) {
      fire('pointermove', 40 + y / 4, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  async function frames(count: number): Promise<void> {
    for (let frame = 0; frame < count; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  it('lies over the columns without taking the pointer', () => {
    const element = canvas();
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(element).pointerEvents).toBe('none');
    const rect = element.getBoundingClientRect();
    const hit = select.shadowRoot?.elementFromPoint(rect.left + 40, rect.top + 30);
    expect(hit?.closest('.item')).not.toBeNull();
  });

  it('follows a finger, then fades out', async () => {
    await slide('touch');
    await frames(2);
    expect(painted().count).toBeGreaterThan(100);

    select.style.setProperty('--liana-trail-duration', '100ms');
    await new Promise((resolve) => setTimeout(resolve, 600));
    await frames(3);
    expect(painted().count).toBe(0);
  });

  it('follows a pen too, but not the mouse by default', async () => {
    await slide('pen');
    await frames(2);
    expect(painted().count).toBeGreaterThan(100);

    select.remove();
    document.body.innerHTML = MARKUP;
    select = find('liana-select');
    await settled();
    await slide('mouse');
    await frames(2);
    expect(painted().count).toBe(0);
  });

  it('follows the mouse with trail="always", and nothing with trail="none"', async () => {
    select.trail = 'always';
    expect(select.getAttribute('trail')).toBe('always');
    await slide('mouse');
    await frames(2);
    expect(painted().count).toBeGreaterThan(100);

    select.remove();
    document.body.innerHTML = MARKUP;
    select = find('liana-select');
    select.setAttribute('trail', 'none');
    await settled();
    await slide('touch');
    await frames(2);
    expect(painted().count).toBe(0);
  });

  it('takes its colour from --liana-trail-color', async () => {
    select.style.setProperty('--liana-trail-color', 'rgb(255, 0, 0)');
    await slide('touch');
    await frames(2);
    expect(painted().colour).toEqual([255, 0, 0]);
  });

  it('does not change what the gesture selects', async () => {
    await slide('touch');
    expect(path()[0]).not.toBe('-');
  });
});

describe('<liana-select> in a form', () => {
  it('submits its value under its name', async () => {
    expect(new FormData(form).get('dish')).toBe('');
    await tap(150, 250);
    expect(select.value).toBe('bread');
    expect(new FormData(form).get('dish')).toBe('bread');
    expect(select.form).toBe(form);
  });

  it('goes back to the markup default on reset', async () => {
    select.querySelector('[value="water"]')?.setAttribute('selected', '');
    await settled();
    await tap(150, 250);
    expect(select.value).toBe('bread');

    form.reset();
    await settled();
    expect(select.value).toBe('water');
    expect(path()).toEqual(['Drinks!', 'Water!']);
    expect(new FormData(form).get('dish')).toBe('water');
  });

  it('shows a value set from a script, without dispatching events', async () => {
    select.value = 'truffle';
    await settled();
    expect(path()).toEqual(['Pizza!', 'Special!', 'Truffle!']);
    expect(new FormData(form).get('dish')).toBe('truffle');
    expect(events).toEqual([]);
  });
});
