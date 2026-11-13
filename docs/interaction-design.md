# Interaction design

This is the owner's original design for `<liana-select>`. It is not modelled on any
existing select component: do not fill gaps with conventions from other widgets.
Anything not written here is undefined, so ask the owner.

Each statement is **agreed** with the owner. The ones under
[Accepted assumptions](#accepted-assumptions) were proposed by the implementer
and accepted without changes: they are the first to revisit if the behaviour
feels wrong.

## Overview

- The component is a large, bordered rectangle, closer to a textarea than to a
  native select. On a tablet it may take almost the whole screen.
- Its content is a horizontal row of columns. Each column shows one level of the
  tree. At first only the leftmost column is visible: the children of the root.
- It is meant to work like a native `<select>` inside a form.

## Markup

The tree is declared with custom child elements, nested freely. Native `<option>`
and `<optgroup>` are not used, because nested `<optgroup>` is invalid HTML.

```html
<liana-select name="dish">
  <liana-group label="Pizza">
    <liana-option value="margherita">Margherita</liana-option>
    <liana-group label="Special">
      <liana-option value="truffle" selected>Truffle</liana-option>
    </liana-group>
  </liana-group>
  <liana-option value="water" disabled>Water</liana-option>
</liana-select>
```

- `<liana-group label>`: a group. Its label comes from the `label` attribute.
- `<liana-option value>`: an option. Its label is its text content.
- `selected` and `disabled` work as on a native `<option>`.

## Terms

- **Item**: an option (leaf) or a group (has children).
- **Path**: the chain of items chosen so far, one per column, starting from the
  first column.
- **Highlighted**: the item under the pointer during a gesture, or under the
  keyboard cursor. Temporary, like a mouse hover. Shown in the accent colour
  mixed half and half with the background of the field, with black or white
  text for contrast: it is where the user is acting, so it
  stands out the most.
- **Selected**: an item the user has chosen: they moved past it, released on it,
  or confirmed it with the keyboard. Shown in a light tint of the accent colour.
- **Accent colour**: by default the colour of the browser's own focus ring, so
  that the component matches the other inputs of the page.
- **Current column**: where the next choice happens. During a gesture it is the
  column under the pointer. At rest it is the column after the last selected
  group, or the column of the selected leaf.
- **Preview column**: the children of the highlighted group, shown to the right of
  the current column while the group is only highlighted.

## The gesture

Mouse, touch and pen behave the same way: press, drag, release.

1. **Press** on an item: it becomes highlighted. If it is a group, its children
   appear in the preview column.
2. **Move within the column**: the highlight follows the pointer and the preview
   column follows the highlight. Over an empty area of the column nothing is
   highlighted and the preview column disappears.
3. **Move right into the preview column**: the highlighted group becomes selected,
   the preview column becomes the current column, and the item under the pointer
   there becomes highlighted. This repeats, level after level, without lifting the
   pointer.
4. **Move left into a previous column**: that column becomes current again and the
   item under the pointer is highlighted, so the user can change an earlier choice
   inside the same gesture. The columns to its right are replaced by the preview
   of the newly highlighted item.
5. **Release**: the highlighted item becomes selected.
   - On a group: the next column becomes current and waits for a new gesture.
   - On an option: the value of the component is set.
   - With nothing highlighted: nothing new is selected in that column.
6. **To the right of the last visible column**: the pointer is treated as if it
   were inside that column. So a highlighted option stays highlighted when the
   gesture overshoots to the right, where there is no column.
7. **Outside the component**: the gesture continues, and the pointer is treated as
   if it were on the nearest point of the component's border.

A selection can be made with one continuous gesture, with one tap per level, or
with any mix of the two: a new gesture can start from the current column to
continue, or from an earlier column to change that choice. There is no cancel
action. To undo a partial selection the user goes back to an earlier column.

## Value and events

- The value is the value of the selected option, or empty when the path does not
  end on a selected option.
- When a value is set and the user then selects a different group, the value is
  cleared.
- The value changes only when a gesture ends. At release the new value is compared
  with the value before the gesture, and `input` and `change` are dispatched only
  if it is different. Nothing is dispatched while the pointer is down.
- Setting a value, from markup or from script, shows the whole path as selected,
  with all its columns. The host application decides what happens after a
  selection, for example animating, then clearing the value to wait for the next
  one.

## Vertical layout and scrolling

- The items of a column share its height (flex), within a configurable minimum and
  maximum item height. A column can therefore be partly empty, or overflow.
- Item heights within a column are not assumed to be equal.
- There are no scrollbars: overflow is hidden everywhere. An overflowing column is
  scrolled by the gesture itself, as a function of the pointer's vertical
  position.

With `H` the visible height of the column, `h0` and `hf` the heights of its first
and last item, and `max` the maximum scroll offset:

- `top = h0 / 2` and `bottom = H - hf / 2`.
- Scroll is `0` when the pointer is at `top` or above, and `max` when it is at
  `bottom` or below. So the first and last item are centred under the pointer at
  the two extremes.
- The interpolation is **anchored**. When the pointer presses on the column or
  enters it, at height `ya`, the column keeps its scroll offset `sa`: nothing jumps
  under the pointer. From there the offset is interpolated linearly, from
  `(top, 0)` to `(ya, sa)` above the anchor and from `(ya, sa)` to `(bottom, max)`
  below it.

Known limit, accepted: the more a column overflows, the less pointer travel each
item gets. Authors are expected to structure their trees so that columns do not
overflow much.

## Horizontal layout

There is never horizontal scrolling and never a horizontal scrollbar.

- **Best case**: the component width is divided into equal parts, one per level of
  the deepest branch of the tree. Columns never shrink.
- Each column has a **minimum content width**. When equal parts would be narrower
  than that, the best case no longer applies: every column is as wide as the
  minimum content width, and the columns to the left of the current one shrink to
  make room.
- The current column is always completely visible.
- When at least one item of the current column is a group, at least 20% of the
  component width stays free to its right, for the preview column.
- The columns to the left share the remaining space in equal parts. A shrunk
  column never goes below a second, smaller **collapsed minimum width**, so it
  stays reachable when the pointer moves back to the left.
- This rule replaces the "at most 50% of the width" limit of the first
  description. It is a first version, to be judged in use.
- Shrinking never re-wraps text. The content of a column keeps its width inside a
  wrapper and the shrunk column simply clips it.

## Accepted assumptions

- Input uses Pointer Events with pointer capture and `touch-action: none`.
- A gesture can start on any visible column, not only the first or the current.
- Moving the mouse without pressing does nothing.
- A group without children behaves as disabled.
- `pointercancel` (the system interrupts the gesture) restores the state the
  component had before the gesture.
- Pressing on an empty area of a column clears the selections from that column
  onwards, consistently with step 2.
- Hit testing uses the settled layout, not the layout in the middle of a
  transition, with a small hysteresis at column borders so the current column
  does not flicker when the layout shifts under the pointer.
- A new column appears with scroll offset `0`. When a preset value is shown, each
  column is scrolled so that its selected item is visible.
- Left columns all shrink to the same width. If they do not fit even at the
  collapsed minimum width, the leftmost ones are hidden until the user goes back.
- A flat tree (one level) uses a single full-width column.
- Highlight and selection colours are themeable, and derive from one accent
  colour.

## Choices made while implementing: to review

The design did not cover these. They were chosen by the implementer and have not
been reviewed by the owner yet.

**When the layout moves under the pointer.** In the shrinking layout, entering a
column moves the columns, so the pointer can end up outside the column it has
just entered, without moving.

- **To its right** (agreed with the owner): what counts is what is under the
  pointer now. Going right, the columns shift left, and the pointer may already
  be over the preview of the item it is choosing. It enters that column at once
  and chooses there by height, and so on, level after level, until it lands on
  an option, an empty area, or a column that does not move. A slide from
  _Europe_ that ends over _Rome_ selects Europe, Italy and Lazio and highlights
  Rome. A column that has not been drawn yet is entered as soon as it is
  measured. A margin of 8 pixels at the border avoids flicker.
- **To its left**: going back makes the columns wider, and can leave the pointer
  over an even earlier column. Following it would jump back several levels at
  once, so until the pointer has been inside the new current column it goes back
  one more column for every 24 pixels of further travel to the left. Sliding
  left leads back to the first column, one level at a time.

In the equal parts layout the columns never move, and none of this applies.

**Other choices.**

- The hysteresis at the borders of the current column is 8 pixels.
- A fast move that crosses several columns in one event goes through each of
  them, choosing by height, as if it had passed over them slowly.
- In the shrinking layout, space that the left columns do not need at their
  collapsed minimum goes first to the preview, up to a full column, then to the
  left columns.
- A press to the right of the last column counts as a press inside it, as for a
  move (step 6 of the gesture).
- A value set from a script before its option exists is remembered, and applied
  when the option appears.
- The `value` of a `<liana-option>` defaults to its label, as for `<option>`. The
  last option marked `selected` wins.
- A form reset goes back to the option marked `selected`, or to no value.
- No transitions or animations yet.
- Scroll offsets are whole pixels, and a column that overflows by less than one
  pixel does not scroll.

**Measuring must settle.** The element draws, measures what it drew and gives
the numbers to the core, which may ask for another draw. Browsers report
fractional sizes with rounding noise that depends on the scroll offset, so this
cycle only ends if the core ignores differences that small and asks for a draw
only when what is drawn would change. Getting this wrong froze the whole page.
Any change to measuring, scrolling or layout has to keep the regression tests
with fractional sizes green.

## Keyboard

Agreed with the owner: the keys move a cursor, and nothing is committed until an
option is confirmed, as the gesture commits only at release.

- The component is one tab stop. Reaching it with the keyboard shows the
  browser's focus ring around it and the cursor: on the selected option, or on
  the first enabled item of the current column. Focus from a click shows
  neither; the first key then places the cursor.
- **↓ / ↑** move to the next or previous enabled item of the column, without
  wrapping. **Home / End** go to the first or last. The column scrolls to keep
  the cursor visible.
- **→** on a group selects it and moves into its column, on the first enabled
  item. **←** goes back to the previous column, on the group it came from.
- **Enter / Space** on an option selects it and commits the value, dispatching
  `input` and `change` if it changed. On a group they act as →.
- **Escape**, or leaving the component with the focus, restores the selection
  from before the keys. Switching to another window does not. Escape is left to
  the page when there is nothing to cancel, so it can still close a dialog.
- **Letters** search the column: the next item whose label starts with what was
  typed in the last 500 ms. A space within those 500 ms is part of the search.
- A gesture during keyboard navigation drops it and starts from the committed
  state.

## Assistive technology

The component is a WAI-ARIA tree, in flat form: one `treeitem` per visible
item, with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` on
groups, `aria-selected` on the selected option and `aria-disabled` where it
applies. The tree points at the cursor, or at the selected option, with
`aria-activedescendant`. Its name comes from `aria-label` on the element, or
from the `<label>` elements associated with it. Items are in column order, not
in tree order: level and position are announced, and the focus is managed by
the component.

## Styling

- `--liana-item-min-height` (default `2.75rem`) and `--liana-item-max-height`
  (default `none`).
- `--liana-column-min-width` (default `10rem`): the minimum content width.
- `--liana-column-collapsed-min-width` (default `4rem`).
- `--liana-accent-color` (default: the colour of the browser's focus ring,
  measured at runtime, otherwise `AccentColor`, otherwise a fixed blue).
- `--liana-highlight-color` (default: the accent mixed 50% with the field
  background), `--liana-highlight-text-color`
  (default: black or white, whichever contrasts more) and
  `--liana-selected-color` (default: a light tint of the accent).
- `::part(column)` and `::part(item)`.

## Open questions

None at the moment.

## To do

- Page scrolling. `touch-action: none` means the page cannot be scrolled by
  touching the component, which may fill the screen. Accepted for now. Evaluate
  alternatives later, for example two-finger scrolling or shift + drag, as
  embedded maps do.
- Try the component with real screen readers, such as VoiceOver and NVDA. So
  far only the roles and states have been checked.
- Try the gesture on real touch devices. So far it has been exercised with a
  mouse and with simulated pointer events only.
- Right-to-left layouts.
- Transitions when columns appear, disappear or change width. None so far.
