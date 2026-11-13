# Changes

What changed in each release of `liana-select`, newest first. Version numbers
follow [semantic versioning](https://semver.org/).

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
