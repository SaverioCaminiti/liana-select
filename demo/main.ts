// Registers <liana-select> from the sources, with hot reload.
import '../src/index';
import type { LianaSelect } from '../src/index';

type MenuEntry = string | [label: string, children: MenuEntry[]];

const menu: MenuEntry[] = [
  [
    'Chinese',
    [
      ['Dumplings', ['Pork dumplings', 'Shrimp dumplings', 'Vegetable dumplings']],
      ['Noodles', ['Chow mein', 'Dan dan noodles', 'Beef noodle soup']],
      ['Rice', ['Egg fried rice', 'Yangzhou fried rice']],
      'Spring rolls',
      'Peking duck',
    ],
  ],
  [
    'Japanese',
    [
      ['Nigiri', ['Nigiri salmon', 'Nigiri tuna', 'Nigiri shrimp', 'Nigiri eel']],
      ['Maki', ['Maki cucumber', 'Maki salmon', 'Maki tuna']],
      ['Ramen', ['Shoyu ramen', 'Miso ramen', 'Tonkotsu ramen']],
      'Edamame',
      'Miso soup',
    ],
  ],
  [
    'Pizza',
    [
      ['Classic', ['Margherita', 'Marinara', 'Napoli', 'Capricciosa']],
      ['Special', ['Truffle', 'Seafood', 'Four cheeses']],
      'Focaccia',
    ],
  ],
  [
    'Italian cuisine',
    [
      ['Pasta', ['Carbonara', 'Amatriciana', 'Cacio e pepe', 'Lasagne']],
      ['Main courses', ['Saltimbocca', 'Milanese cutlet', 'Grilled sea bass']],
      ['Desserts', ['Tiramisu', 'Panna cotta']],
    ],
  ],
  [
    'Drinks',
    ['Still water', 'Sparkling water', ['Beer', ['Lager', 'Pale ale']], 'House wine'],
  ],
  ['Other', ['Bread basket', 'Mixed salad', 'French fries']],
];

const wines: MenuEntry[] = [
  ['Red', Array.from({ length: 40 }, (_, index) => `Red wine no. ${String(index + 1)}`)],
  [
    'White',
    Array.from({ length: 12 }, (_, index) => `White wine no. ${String(index + 1)}`),
  ],
  'Sparkling water',
];

function toValue(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Builds the <liana-group> / <liana-option> children for a list of entries. */
function buildChildren(
  entries: MenuEntry[],
  selectedValue: string | undefined,
): Element[] {
  return entries.map((entry) => {
    if (typeof entry === 'string') {
      const option = document.createElement('liana-option');
      option.value = toValue(entry);
      option.textContent = entry;
      option.selected = option.value === selectedValue;
      return option;
    }
    const [label, children] = entry;
    const group = document.createElement('liana-group');
    group.label = label;
    group.append(...buildChildren(children, selectedValue));
    return group;
  });
}

function log(list: HTMLElement | null, text: string): void {
  if (list === null) return;
  const item = document.createElement('li');
  item.textContent = text;
  list.prepend(item);
  while (list.children.length > 8) list.lastElementChild?.remove();
}

const events = document.getElementById('events');

for (const select of document.querySelectorAll<LianaSelect>('liana-select')) {
  const entries = 'wines' in select.dataset ? wines : menu;
  select.append(...buildChildren(entries, select.dataset.selected));

  const output = document.getElementById(`${select.id}-value`);
  const showValue = (): void => {
    if (output !== null) output.textContent = `value: ${JSON.stringify(select.value)}`;
  };
  select.addEventListener('change', showValue);
  for (const type of ['input', 'change']) {
    select.addEventListener(type, () => {
      log(events, `${type} on #${select.id}: ${JSON.stringify(select.value)}`);
    });
  }
  // The children are read after this script: show the initial value once they are.
  void select.updateComplete.then(showValue);
}

// The host application decides what happens after a selection. Here: submitting
// adds the dish to the cart, then the select is cleared for the next one.
const form = document.querySelector<HTMLFormElement>('#order');
const cart = document.getElementById('cart');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const dish = new FormData(form).get('dish');
  if (typeof dish !== 'string' || dish === '') {
    log(cart, 'Pick a dish first.');
    return;
  }
  log(cart, `Added: ${dish}`);
  setTimeout(() => {
    form.reset();
  }, 1000);
});
// A reset changes the value without dispatching events: refresh the read-out.
form?.addEventListener('reset', () => {
  setTimeout(() => {
    const select = document.querySelector<LianaSelect>('#menu');
    const output = document.getElementById('menu-value');
    if (select !== null && output !== null) {
      output.textContent = `value: ${JSON.stringify(select.value)}`;
    }
  });
});
