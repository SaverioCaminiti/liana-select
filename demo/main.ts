// Registers <liana-select> from the sources, with hot reload.
import '../src/index';
import type { LianaSelect } from '../src/index';

import { buildChildren, menu, wines } from './menu';

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
