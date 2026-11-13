# Changes

What changed in each release of `liana-select`, newest first. Version numbers
follow [semantic versioning](https://semver.org/).

## 1.2.0 - 2026-11-13

### Added

- Keyboard navigation. The select is one tab stop; the arrow keys, Home and End
  move a cursor, → and ← go into and out of groups, Enter or Space confirm an
  option, Escape restores the previous choice, and letters jump to an item by
  its label. Nothing is committed until an option is confirmed.
- ARIA: the select is a tree for assistive technology, with the level, position
  and state of each item. It takes its name from `aria-label` or from its
  `<label>`.
- The focus ring of the browser when the select is reached with the keyboard.
- `--liana-accent-color`, from which all the colours derive, and
  `--liana-highlight-text-color`.

### Changed

- Default colours: the item under the pointer or the cursor takes the colour of
  the browser's focus ring mixed half and half with the background of the
  field, with black or white text for contrast, and selected items a lighter
  tint of it. The green of selected items is gone.
- `value` read during a gesture now returns the committed value. Before, it could
  briefly read as empty while the pointer was on a group. Events and the form
  value were already updated only at release.

### Fixed

- In a narrow space, a slide to the right could stop one level short: entering a
  column moves the columns to the left, and the pointer, already over the next
  column, kept choosing in the previous one. It now chooses what is under it.

### Known limitations

- The element takes over every touch on it, so the page cannot be scrolled by
  dragging on it.
- The search by label looks in the column of the cursor only.
- No right-to-left layout, and no transitions when columns appear or resize.
- Not tried yet with every screen reader.
- The package is not published to a registry.

## 1.1.0 - 2026-11-13

### Added

- A documentation site with live examples, published on
  [GitHub Pages](https://saveriocaminiti.github.io/liana-select/) at every
  release.

### Fixed

- A bundler could drop the registration of `<liana-group>` and
  `<liana-option>` when building an application, because their modules were not
  marked as having side effects.

## 1.0.0 - 2026-11-13

First release.

### Added

- `<liana-select>`, a select for picking one option from a tree. It shows one
  column per level of the tree, starting with the first.
- The selection gesture: press on a group, slide right into the column of its
  children, keep going, and release on an option. One tap per level works too,
  and sliding back left changes an earlier choice. The item under the pointer is
  highlighted in blue, the chosen ones are shown in green.
- `<liana-group label>` and `<liana-option value>`, nested freely, to declare the
  tree in markup. Options and groups can be `disabled`, and an option can be
  marked `selected`. The element follows later changes to its children.
- Form support, like a native `<select>`: `name`, `value` and `disabled`,
  submission, reset, state restoration, and `input` and `change` events when the
  user picks a different option.
- Vertical scrolling without scrollbars: a column with more items than fit
  scrolls with the height of the pointer, anchored where the pointer pressed or
  entered so that nothing jumps under it.
- Horizontal layout without scrolling: the columns share the width in equal
  parts when the tree depth allows it. Otherwise the current column stays whole
  and the ones to its left shrink, clipping their text instead of re-wrapping it.
- Styling through the custom properties `--liana-item-min-height`,
  `--liana-item-max-height`, `--liana-column-min-width`,
  `--liana-column-collapsed-min-width`, `--liana-highlight-color` and
  `--liana-selected-color`, and through `::part(column)` and `::part(item)`.
  Light and dark colour schemes are supported.
- `liana-select/core`, the headless core behind the element: tree model,
  navigation, layout, scrolling and the gesture state machine, with no DOM
  dependency.
- A demo page with a restaurant menu in several configurations.

### Known limitations

- No keyboard navigation and no ARIA roles yet: the element cannot be used
  without a pointer.
- The element takes over every touch on it, so the page cannot be scrolled by
  dragging on it.
- No right-to-left layout, and no transitions when columns appear or resize.
- The package is not published to a registry.
