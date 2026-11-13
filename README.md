# liana-select

> Swing through a tree of options and select one in a single, swift gesture.

`<liana-select>` is a framework-agnostic web component for picking an item from a
hierarchical list (categories, subcategories, items). Like a liana, it lets you move
through the tree in one continuous motion: on touch screens a selection can be made
with a single gesture.

## Status

Early development. The interaction works, but nothing is published yet, and
keyboard navigation and ARIA are still missing.

## Usage

Import the package once to register the elements, then declare the tree with
nested `<liana-group>` and `<liana-option>` children:

```html
<script type="module">
  import 'liana-select';
</script>

<form>
  <liana-select name="dish">
    <liana-group label="Pizza">
      <liana-option value="margherita">Margherita</liana-option>
      <liana-group label="Special">
        <liana-option value="truffle" selected>Truffle</liana-option>
        <liana-option value="seafood">Seafood</liana-option>
      </liana-group>
    </liana-group>
    <liana-option value="bread" disabled>Bread</liana-option>
  </liana-select>
</form>
```

It behaves like a native `<select>`: it has a `name` and a `value`, it is
submitted and reset with its form, and it dispatches `input` and `change` when the
user picks a different option.

```js
const select = document.querySelector('liana-select');
select.addEventListener('change', () => console.log(select.value));
select.value = 'seafood'; // opens the whole path to that option
select.value = ''; // back to the first column
```

To select, press on a group, slide right into its column, keep going, and release
on an option: one gesture. One tap per level works too, and sliding back left
changes an earlier choice.

The element is a block, `20rem` tall by default: size it with CSS. It is meant to
be large, and it takes over every touch on it, so the page cannot be scrolled by
dragging on it.

### Styling

| Custom property                      | Default    | Purpose                                    |
| ------------------------------------ | ---------- | ------------------------------------------ |
| `--liana-item-min-height`            | `2.75rem`  | Minimum height of an item                  |
| `--liana-item-max-height`            | `none`     | Maximum height of an item                  |
| `--liana-column-min-width`           | `10rem`    | Minimum width of a column before shrinking |
| `--liana-column-collapsed-min-width` | `4rem`     | Minimum width of a shrunk column           |
| `--liana-highlight-color`            | blue tint  | Background of the item under the pointer   |
| `--liana-selected-color`             | green tint | Background of a selected item              |

Columns and items are also exposed as `::part(column)` and `::part(item)`.

The full behaviour is specified in
[docs/interaction-design.md](docs/interaction-design.md).

## Development

```sh
pnpm install
pnpm exec playwright install --only-shell chromium  # once, for the browser tests
pnpm dev           # demo page with hot reload
pnpm test          # core tests, in Node
pnpm test:browser  # element tests, in headless Chromium
pnpm typecheck && pnpm lint && pnpm build
```

The code is split in two: a headless core in `src/core` (tree, navigation, layout,
scroll and the gesture state machine, with no DOM) and a thin Lit element in
`src/element` that measures, forwards pointer events and draws.

## Tech stack

- TypeScript
- [Lit](https://lit.dev/) for the custom element
- [Vite](https://vite.dev/) in library mode for the build
- [Vitest](https://vitest.dev/), with [Playwright](https://playwright.dev/) for
  the browser tests
