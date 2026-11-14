# liana-select

> Swing through a tree of options and select one in a single, swift gesture.

`<liana-select>` is a framework-agnostic web component for picking an item from a
hierarchical list (categories, subcategories, items). Like a liana, it lets you move
through the tree in one continuous motion: on touch screens a selection can be made
with a single gesture.

**Documentation and live examples:**
[saveriocaminiti.github.io/liana-select](https://saveriocaminiti.github.io/liana-select/)

## Status

The interaction works with mouse, touch, pen and keyboard, and the element is
exposed to assistive technology as a tree. See [CHANGES.md](CHANGES.md) for the
history, and the [documentation site](https://saveriocaminiti.github.io/liana-select/)
for live examples. Feedback is welcome in the
[issues](https://github.com/SaverioCaminiti/liana-select/issues).

## Installation

```sh
pnpm add liana-select
# or: npm install liana-select
```

Its only dependency is [Lit](https://lit.dev/). Without a build step, it can be
loaded from a CDN that bundles it:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/liana-select@1/+esm"></script>
```

### Browser support

Current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile.
Because of the CSS and DOM features it relies on, the minimum versions are
Chrome and Edge 125, Firefox 126 and Safari 17.5. The tests run on the engines
of all three.

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
changes an earlier choice. With the keyboard, Tab into it, move with the arrow
keys and confirm with Enter; Escape restores the previous choice. For assistive
technology it is a tree: name it with `aria-label` or a `<label for>`.

On a touch screen it draws a short trail that fades behind the finger. Set
`trail="always"` to show it for the mouse too, or `trail="none"` to turn it off.
It is never drawn when the user asks for reduced motion.

The element is a block, `20rem` tall by default: size it with CSS. It is meant to
be large, and it takes over every touch on it, so the page cannot be scrolled by
dragging on it.

### Styling

| Custom property                      | Default      | Purpose                                                |
| ------------------------------------ | ------------ | ------------------------------------------------------ |
| `--liana-item-min-height`            | `2.75rem`    | Minimum height of an item                              |
| `--liana-item-max-height`            | `none`       | Maximum height of an item                              |
| `--liana-column-min-width`           | `10rem`      | Minimum width of a column before shrinking             |
| `--liana-column-collapsed-min-width` | `4rem`       | Minimum width of a shrunk column                       |
| `--liana-accent-color`               | focus ring   | Base of all the colours, and the focus ring            |
| `--liana-highlight-color`            | half accent  | Background of the item under the pointer or the cursor |
| `--liana-highlight-text-color`       | contrast     | Text of the item under the pointer or the cursor       |
| `--liana-selected-color`             | light accent | Background of a selected item                          |
| `--liana-trail-color`                | accent       | Colour of the trail                                    |
| `--liana-trail-width`                | `6px`        | Width of the trail at the pointer                      |
| `--liana-trail-duration`             | `400ms`      | How long a piece of the trail takes to fade out        |

Columns and items are also exposed as `::part(column)` and `::part(item)`.

The full behaviour is specified in
[docs/interaction-design.md](docs/interaction-design.md).

## Development

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit  # once, for the browser tests
pnpm dev           # demo page with hot reload
pnpm site:dev      # documentation site with hot reload
pnpm test          # core tests, in Node
pnpm test:browser  # element tests, in Chromium, Firefox and WebKit
pnpm typecheck && pnpm lint && pnpm build
```

The code is split in two: a headless core in `src/core` (tree, navigation, layout,
scroll and the gesture state machine, with no DOM) and a thin Lit element in
`src/element` that measures, forwards pointer and key events and draws.

Releases and publication on npm are described in
[docs/releasing.md](docs/releasing.md).

## Tech stack

- TypeScript
- [Lit](https://lit.dev/) for the custom element
- [Vite](https://vite.dev/) in library mode for the build
- [Vitest](https://vitest.dev/), with [Playwright](https://playwright.dev/) for
  the browser tests
