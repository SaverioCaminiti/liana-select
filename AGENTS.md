# liana-select

Tagline: "Swing through a tree of options and select one in a single, swift gesture."

## What this is

A web component, `<liana-select>`, that works as a special select for HTML pages.
It lets the user pick an item quickly from lists structured as a tree (categories
and subcategories). On touch screens a selection must be possible with one single
gesture. It must be usable in plain HTML and inside any framework.

## Decisions already made

- Project, package and tag name: `liana-select` / `<liana-select>`.
- Stack: TypeScript + Lit + Vite in library mode.
- Architecture: a headless core plus a thin element wrapper.
  - `core`: pure TypeScript, no Lit imports and no DOM dependencies where avoidable.
    Holds the tree model, navigation state and gesture state machine. Must be
    unit-testable without a browser.
  - `element`: the Lit custom element. Renders, wires DOM events into the core,
    exposes attributes, properties and events.
  - Keep the boundary strict so the wrapper can be replaced later (for example by a
    dependency-free custom element) without touching the core.
  - The boundary is enforced by tooling: `src/core` is type-checked with
    `tsconfig.core.json`, which has no DOM lib, and ESLint forbids importing `lit`
    or the element from `src/core`.
- Tooling: pnpm, Vitest in two projects (`core` in Node with no DOM, `browser` in
  headless Chromium through Playwright for the element), ESLint flat config with
  `typescript-eslint` (strict, type-aware), `eslint-plugin-lit`, `eslint-plugin-wc`,
  and Prettier for formatting.
- TypeScript is pinned to 6.0 because `typescript-eslint` does not support 7.x yet.
- Package layout: one package with two entry points, `liana-select` (registers the
  element) and `liana-select/core` (headless core). ESM only; Lit stays external.
  The package is `private` until publishing is decided.

- Interaction design: specified in `docs/interaction-design.md`. It is the owner's
  original design, not modelled on existing select components. Read it before
  touching the gesture, the layout or the scrolling, and keep it up to date.
- Data input: the tree is declared with nested `<liana-group label>` and
  `<liana-option value>` child elements, not with native `<option>` / `<optgroup>`.
- Input handling: Pointer Events with pointer capture and `touch-action: none`,
  one code path for mouse, touch and pen.
- Form-associated custom element (`ElementInternals`), so it behaves like a native
  `<select>` inside a `<form>`.

## Proposed, not yet confirmed by the owner

Discuss these before building on them:

- Full keyboard navigation and ARIA roles, since the single gesture is not usable
  by everyone. Deferred: listed as to do in `docs/interaction-design.md`.
- Theming through CSS custom properties and `::part`.

## Not yet defined: ask, do not invent

- Anything about the interaction that `docs/interaction-design.md` does not state.
- Public API beyond what that document fixes: names of further attributes,
  properties, events and CSS custom properties.
- License (a MIT `LICENSE` file exists, but it is not confirmed), publishing to a
  registry, and CI for tests and lint.

## Conventions

- All code is entirely in English: variable, function and class names, comments,
  commit messages and documentation.
- Conversation with the owner can be in Italian or English.
- Keep runtime dependencies to Lit only unless the owner agrees otherwise.
- Branching follows git-flow: `main` is production, `develop` is integration,
  with the default prefixes `feature/`, `release/`, `hotfix/`, `support/` and no
  version tag prefix. Do not commit directly to `main`.
- Releases are made with `git flow release`. On the release branch, set the
  version in `package.json` and describe the release in `CHANGES.md`, which lists
  what changed between one release and the next, newest first.

## Commands

- `pnpm install`: install dependencies.
- `pnpm dev`: serve the demo page (`demo/index.html`) with hot reload.
- `pnpm build`: build `dist/` (Vite library build, then `.d.ts` files via `tsc`).
- `pnpm test` / `pnpm test:watch`: run the core tests, in Node.
- `pnpm test:browser`: run the element tests (`*.browser.test.ts`) in headless
  Chromium. Needs `pnpm exec playwright install --only-shell chromium` once.
- `pnpm test:all`: run both.
- `pnpm typecheck`: type-check core (no DOM), element and demo, and tooling files.
- `pnpm lint`: run ESLint.
- `pnpm format` / `pnpm format:check`: run Prettier.
- `pnpm site:dev` / `pnpm site:build` / `pnpm site:preview`: the documentation
  site in `site/`, built into `dist-site/`. Unlike the library build it bundles
  Lit, so the examples run as they are.

## Current status

Version 1.1.0 is released: the interaction designed in
`docs/interaction-design.md` is implemented.

- `src/core`: `tree.ts` (model), `navigation.ts` (selected path and highlight),
  `scroll.ts` (anchored vertical scroll), `layout.ts` (column widths),
  `hit-test.ts`, and `controller.ts` (`LianaController`, the gesture state machine
  that composes them).
- `src/element`: `liana-select.ts` (form-associated Lit element), the data
  elements `liana-group.ts` and `liana-option.ts`, and `read-tree.ts`.
- `demo/`: a restaurant menu in several configurations, for development. Its
  menu data lives in `demo/menu.ts`, shared with the site.
- `site/`: the documentation site published on GitHub Pages by
  `.github/workflows/pages.yml` on every push to `main`, that is on every
  release. Each example shows the exact code it runs: keep it that way, and
  update the site when the public API changes.

Next steps: the owner reviews the "Choices made while implementing" section of
the design document and tries the gesture on a real touch device. Then keyboard
navigation and ARIA.
