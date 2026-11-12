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
- Tooling: pnpm, Vitest (core tests run in Node, no DOM), ESLint flat config with
  `typescript-eslint` (strict, type-aware), `eslint-plugin-lit`, `eslint-plugin-wc`,
  and Prettier for formatting.
- TypeScript is pinned to 6.0 because `typescript-eslint` does not support 7.x yet.
- Package layout: one package with two entry points, `liana-select` (registers the
  element) and `liana-select/core` (headless core). ESM only; Lit stays external.
  The package is `private` until publishing is decided.

## Proposed, not yet confirmed by the owner

Discuss these before building on them:

- Pointer Events with pointer capture and `touch-action: none`, one code path for
  mouse, touch and pen.
- Form-associated custom element (`ElementInternals`) so it behaves like a native
  `<select>` inside a `<form>`.
- Full keyboard navigation and ARIA roles designed from the start, since the
  single gesture is not usable by everyone.
- Theming through CSS custom properties and `::part`.

## Not yet defined: ask, do not invent

- The interaction design of the single gesture (how levels open, how the user
  moves between them, how a selection is committed or cancelled).
- The data input format (attribute, property, slotted markup, or a mix).
- Public API: attribute, property and event names.
- Browser tests for the element (proposed: Vitest browser mode with Playwright,
  added once the element has behaviour worth testing).
- License (a MIT `LICENSE` file exists, but it is not confirmed), publishing and CI.

## Conventions

- All code is entirely in English: variable, function and class names, comments,
  commit messages and documentation.
- Conversation with the owner can be in Italian or English.
- Keep runtime dependencies to Lit only unless the owner agrees otherwise.
- Branching follows git-flow: `main` is production, `develop` is integration,
  with the default prefixes `feature/`, `release/`, `hotfix/`, `support/` and no
  version tag prefix. Do not commit directly to `main`.

## Commands

- `pnpm install`: install dependencies.
- `pnpm dev`: serve the demo page (`demo/index.html`) with hot reload.
- `pnpm build`: build `dist/` (Vite library build, then `.d.ts` files via `tsc`).
- `pnpm test` / `pnpm test:watch`: run the Vitest suite.
- `pnpm typecheck`: type-check core (no DOM), element and demo, and tooling files.
- `pnpm lint`: run ESLint.
- `pnpm format` / `pnpm format:check`: run Prettier.

## Current status

Scaffolded. `src/core/tree.ts` holds a minimal, provisional internal tree model
(`TreeNode`, `NodePath`, `isLeaf`, `getNodeAtPath`, `findPathById`) with tests. It
is not the public input format. `src/element/liana-select.ts` is a placeholder
element with no public API. Next step: design the single gesture with the owner.
