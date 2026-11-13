// The restaurant menu shared by the demo page and by the documentation site.
import '../src/index';

export type MenuEntry = string | [label: string, children: MenuEntry[]];

export const menu: MenuEntry[] = [
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
      [
        'Classic',
        [
          'Margherita',
          'Marinara',
          'Napoli',
          'Capricciosa',
          'Quattro stagioni',
          'Diavola',
          'Prosciutto e funghi',
          'Bufala',
          'Ortolana',
          'Boscaiola',
          'Romana',
          'Siciliana',
          'Tonno e cipolla',
          'Salsiccia e friarielli',
          'Parmigiana',
          'Pugliese',
          'Bresaola e rucola',
          'Calzone',
        ],
      ],
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

export const wines: MenuEntry[] = [
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
export function buildChildren(entries: MenuEntry[], selectedValue?: string): Element[] {
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
