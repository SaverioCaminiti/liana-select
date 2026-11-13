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
