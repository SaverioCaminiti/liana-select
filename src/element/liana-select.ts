import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  isEnabled,
  LianaController,
  type ColumnMetrics,
  type ColumnView,
  type ItemView,
  type KeyboardAction,
  type NodePath,
} from '../core/index';
import { contrastingText } from './contrast';
import './liana-group';
import './liana-option';
import { readTree } from './read-tree';

/** How many times the element may measure itself before the browser runs a task. */
const MAX_MEASURE_PASSES = 10;

/** Attributes of the child elements that change the tree. */
const TREE_ATTRIBUTES = ['value', 'label', 'disabled', 'selected'];

/** Keys that drive the keyboard cursor. Letters drive the search by label. */
const KEY_ACTIONS: Partial<Record<string, KeyboardAction>> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
  ArrowRight: 'enter',
  ArrowLeft: 'back',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'cancel',
};

/** How long typed letters keep adding up to one search, in milliseconds. */
const TYPEAHEAD_TIMEOUT = 500;

/** Accent colour when the browser tells none. */
const FALLBACK_ACCENT = '#0075ff';

function itemId(path: NodePath): string {
  return `item-${path.join('-')}`;
}

/**
 * `<liana-select>`: a select for picking one option from a tree, with a single
 * gesture or with one tap per level.
 *
 * The tree is declared with nested `<liana-group>` and `<liana-option>`
 * children. Inside a `<form>` it behaves like a native `<select>`: it has a
 * `name`, a `value`, and dispatches `input` and `change`.
 *
 * It can be used with a pointer, with a single gesture or one tap per level,
 * and with the keyboard. For assistive technology it is a tree.
 *
 * All the behaviour lives in the core (`LianaController`). This element reads
 * the markup, measures the DOM, forwards pointer and keyboard events and draws
 * the view. See `docs/interaction-design.md`.
 *
 * @fires input - The user selected a different value.
 * @fires change - The user selected a different value.
 *
 * @csspart column - A column of items.
 * @csspart item - An option or a group.
 *
 * @cssprop --liana-item-min-height - Minimum height of an item.
 * @cssprop --liana-item-max-height - Maximum height of an item.
 * @cssprop --liana-column-min-width - Minimum width of a column that is not shrunk.
 * @cssprop --liana-column-collapsed-min-width - Minimum width of a shrunk column.
 * @cssprop --liana-accent-color - Base colour of the focus ring, the highlighted
 *   and the selected items. Defaults to the colour of the browser's focus ring.
 * @cssprop --liana-highlight-color - Background of the item under the pointer or
 *   the keyboard cursor. Defaults to the accent colour mixed half and half with
 *   the background of the field.
 * @cssprop --liana-highlight-text-color - Text of the item under the pointer or
 *   the keyboard cursor. Defaults to black or white, whichever contrasts more
 *   with its background.
 * @cssprop --liana-selected-color - Background of a selected item. Defaults to a
 *   light tint of the accent colour.
 */
@customElement('liana-select')
export class LianaSelect extends LitElement {
  static readonly formAssociated = true;

  // Focusing the element, with Tab or `focus()`, focuses the tree inside it.
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-label', 'disabled'];
  }

  static override styles = css`
    :host {
      display: block;
      position: relative;
      box-sizing: border-box;
      height: 20rem;
      overflow: hidden;
      border: 1px solid light-dark(#767676, #858585);
      border-radius: 4px;
      background: Field;
      color: FieldText;
      color-scheme: light dark;
      cursor: default;
      user-select: none;
      -webkit-user-select: none;
      /* The gesture owns every touch: no native scrolling or zooming. */
      touch-action: none;
      /* Thin lines between columns and between items. */
      --_liana-divider: color-mix(in srgb, currentColor 15%, transparent);
      /* The system accent is measured at runtime: see #updateTheme. */
      --_liana-accent: var(--liana-accent-color, var(--_liana-system-accent, #0075ff));
      --_liana-highlight: var(
        --liana-highlight-color,
        color-mix(in srgb, var(--_liana-accent) 50%, Field)
      );
    }

    /* The same ring as the other inputs of the page, when reached with the keyboard. */
    :host(:state(focus-visible)) {
      outline: var(--_liana-accent) auto 1px;
    }

    :host(:disabled) {
      opacity: 0.5;
      pointer-events: none;
    }

    .columns {
      display: flex;
      height: 100%;
      overflow: hidden;
      /* The ring is drawn around the host instead. */
      outline: none;
    }

    .column {
      position: relative;
      flex: 0 0 auto;
      height: 100%;
      overflow: hidden;
    }

    /* Divider drawn over the content, so it does not take width from the column. */
    .column::after {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-end: 0;
      width: 1px;
      background: var(--_liana-divider);
      pointer-events: none;
    }

    /* Keeps its own width when the column shrinks: the text never re-wraps. */
    .content {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-height: 100%;
    }

    .item {
      display: flex;
      flex: 1 0 auto;
      align-items: center;
      gap: 0.5rem;
      box-sizing: border-box;
      min-height: var(--liana-item-min-height, 2.75rem);
      max-height: var(--liana-item-max-height, none);
      padding: 0.25rem 0.75rem;
      overflow: hidden;
    }

    .item + .item {
      border-top: 1px solid var(--_liana-divider);
    }

    /* The item under the pointer or the cursor stands out the most. */
    .item[data-state='highlighted'] {
      background: var(--_liana-highlight);
      color: var(--liana-highlight-text-color, var(--_liana-on-highlight, #fff));
    }

    .item[data-state='selected'] {
      background: var(
        --liana-selected-color,
        color-mix(in srgb, var(--_liana-accent) 28%, Field)
      );
    }

    .label {
      flex: 1 1 auto;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .item[data-kind='group']::after {
      content: '›';
      flex: none;
      opacity: 0.6;
    }

    /* Dim the text only, so the line above a disabled item stays like the others. */
    .item[data-disabled] > .label,
    .item[data-disabled]::after {
      opacity: 0.4;
    }

    /* Invisible rulers that turn the width custom properties into pixels. */
    .probe {
      position: absolute;
      visibility: hidden;
      height: 0;
      pointer-events: none;
    }

    .probe-min {
      width: var(--liana-column-min-width, 10rem);
    }

    .probe-collapsed {
      width: var(--liana-column-collapsed-min-width, 4rem);
    }

    /* Tells the colour of the browser's focus ring, where it has a name for it. */
    .probe-ring {
      outline-color: -webkit-focus-ring-color;
    }

    /* Tells the background of the highlighted item, to pick a text colour for it. */
    .probe-highlight {
      color: var(--_liana-highlight);
    }
  `;

  readonly #internals = this.attachInternals();
  readonly #controller = new LianaController();
  readonly #treeObserver = new MutationObserver(() => {
    this.#readTree();
  });
  readonly #resizeObserver = new ResizeObserver(() => {
    this.#measure();
  });

  /** Value asked for by a script or chosen by the user; `undefined` until then. */
  #wantedValue: string | undefined;
  /** Value of the option marked `selected` in the markup. */
  #defaultValue = '';
  /** Pointer that owns the gesture in progress. */
  #pointerId: number | undefined;
  /** Measurements taken since the browser last ran a task. */
  #measurePasses = 0;
  /** Letters typed for the search by label, and the timer that clears them. */
  #typed = '';
  #typedTimer: ReturnType<typeof setTimeout> | undefined;
  /** Colours measured at runtime, in a style sheet of their own. */
  readonly #themeSheet = new CSSStyleSheet();
  #themeRules = '';
  /** The browser's focus ring, and so the accent, changes with the colour scheme. */
  readonly #darkScheme = matchMedia('(prefers-color-scheme: dark)');
  readonly #onSchemeChange = (): void => {
    this.#updateTheme();
  };

  @query('.columns') private _columns!: HTMLElement | null;
  @query('.probe-min') private _minProbe!: HTMLElement | null;
  @query('.probe-collapsed') private _collapsedProbe!: HTMLElement | null;
  @query('.probe-ring') private _ringProbe!: HTMLElement | null;
  @query('.probe-highlight') private _highlightProbe!: HTMLElement | null;

  constructor() {
    super();
    this.#controller.onViewChange = () => {
      this.requestUpdate();
    };
    this.#controller.onValueCommit = (value) => {
      this.#wantedValue = value;
      this.#syncFormValue();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  /**
   * The value of the selected option, or `''` when none is selected.
   *
   * Setting it shows the whole path to the option with that value. A value that
   * no option has yet is remembered and applied when the option appears.
   */
  @property()
  get value(): string {
    return this.#controller.value;
  }
  set value(value: string | null) {
    this.#wantedValue = value ?? '';
    this.#controller.setValue(this.#wantedValue);
    this.#syncFormValue();
  }

  /** Name under which the value is submitted with the form. */
  get name(): string {
    return this.getAttribute('name') ?? '';
  }
  set name(name: string) {
    this.setAttribute('name', name);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(disabled: boolean) {
    this.toggleAttribute('disabled', disabled);
  }

  /** The form this element belongs to, if any. */
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#treeObserver.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TREE_ATTRIBUTES,
    });
    this.#resizeObserver.observe(this);
    this.#darkScheme.addEventListener('change', this.#onSchemeChange);
    this.#readTree();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#treeObserver.disconnect();
    this.#resizeObserver.disconnect();
    this.#darkScheme.removeEventListener('change', this.#onSchemeChange);
    this.#cancelGesture();
    this.#controller.keyboardBlur();
  }

  override attributeChangedCallback(
    name: string,
    old: string | null,
    value: string | null,
  ): void {
    super.attributeChangedCallback(name, old, value);
    // The accessible name and the focusability depend on these.
    if (name === 'aria-label' || name === 'disabled') this.requestUpdate();
  }

  /** Called by the browser when the element, or its fieldset, is disabled or enabled. */
  formDisabledCallback(disabled: boolean): void {
    if (disabled) this.#controller.keyboardBlur();
    this.requestUpdate();
  }

  /** Called by the browser when the form is reset: back to the markup default. */
  formResetCallback(): void {
    this.#wantedValue = undefined;
    this.#controller.setValue(this.#defaultValue);
    this.#syncFormValue();
  }

  /** Called by the browser when it restores the form, for example on back navigation. */
  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === 'string') this.value = state;
  }

  protected override render(): TemplateResult {
    const view = this.#controller.view;
    const disabled = this.matches(':disabled');
    // The item that the screen reader reads as focused: the cursor, otherwise
    // the selected option.
    const active =
      view.cursor ??
      view.columns
        .flatMap((column) => column.items)
        .find((item) => item.node.kind === 'option' && item.state === 'selected')?.path;
    return html`
      <div
        class="columns"
        role="tree"
        tabindex=${disabled ? -1 : 0}
        aria-label=${this.#accessibleName() ?? nothing}
        aria-disabled=${disabled ? 'true' : nothing}
        aria-activedescendant=${active === undefined ? nothing : itemId(active)}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @lostpointercapture=${this.#onPointerCancel}
        @keydown=${this.#onKeyDown}
        @focus=${this.#onFocus}
        @blur=${this.#onBlur}
      >
        ${repeat(
          view.columns,
          (column) => column.key,
          (column) => this.#renderColumn(column),
        )}
      </div>
      <div class="probe probe-min" aria-hidden="true"></div>
      <div class="probe probe-collapsed" aria-hidden="true"></div>
      <div class="probe probe-ring" aria-hidden="true"></div>
      <div class="probe probe-highlight" aria-hidden="true"></div>
    `;
  }

  #renderColumn(column: ColumnView): TemplateResult {
    return html`
      <div
        class="column"
        part="column"
        role="none"
        data-key=${column.key}
        data-role=${column.role}
        style=${styleMap({ width: `${String(column.width)}px` })}
      >
        <div
          class="content"
          role="none"
          style=${styleMap({
            width: `${String(column.contentWidth)}px`,
            transform: `translateY(${String(-column.scroll)}px)`,
          })}
        >
          ${column.items.map((item, index) =>
            this.#renderItem(item, index, column.items.length),
          )}
        </div>
      </div>
    `;
  }

  #renderItem(item: ItemView, index: number, count: number): TemplateResult {
    const { node } = item;
    return html`
      <div
        class="item"
        part="item"
        id=${itemId(item.path)}
        role="treeitem"
        aria-level=${item.path.length}
        aria-posinset=${index + 1}
        aria-setsize=${count}
        aria-expanded=${node.kind === 'group' ? String(item.expanded) : nothing}
        aria-selected=${
          node.kind === 'option' && item.state === 'selected' ? 'true' : nothing
        }
        aria-disabled=${isEnabled(node) ? nothing : 'true'}
        data-kind=${node.kind}
        data-state=${item.state}
        ?data-disabled=${node.disabled === true}
        data-value=${node.kind === 'option' ? node.value : nothing}
      >
        <span class="label">${node.label}</span>
      </div>
    `;
  }

  protected override firstUpdated(): void {
    const root = this.renderRoot as ShadowRoot;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.#themeSheet];
  }

  protected override updated(): void {
    this.#updateTheme();
    this.#measure();
  }

  /** The `aria-label` of the element, otherwise the text of its `<label>` elements. */
  #accessibleName(): string | undefined {
    const label = this.getAttribute('aria-label');
    if (label !== null) return label;
    const texts = Array.from(this.#internals.labels, (element) =>
      (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ).filter((text) => text !== '');
    return texts.length > 0 ? texts.join(' ') : undefined;
  }

  /**
   * Measures the colours that CSS alone cannot provide: the colour of the
   * browser's focus ring, which becomes the default accent, and a text colour
   * that contrasts with the background of the highlighted item.
   */
  #updateTheme(): void {
    const ring = this._ringProbe;
    const highlight = this._highlightProbe;
    if (ring === null || highlight === null) return;

    let accent = FALLBACK_ACCENT;
    if (CSS.supports('outline-color', '-webkit-focus-ring-color')) {
      // Chrome and Safari: the very colour of the ring around a focused input.
      accent = getComputedStyle(ring).outlineColor;
    } else if (CSS.supports('color', 'AccentColor')) {
      // Firefox: the system accent colour, which its focus ring uses too.
      accent = 'AccentColor';
    }
    this.#setThemeRules(`:host { --_liana-system-accent: ${accent}; }`);

    const text = contrastingText(getComputedStyle(highlight).color);
    this.#setThemeRules(
      `:host { --_liana-system-accent: ${accent}; --_liana-on-highlight: ${text}; }`,
    );
  }

  #setThemeRules(rules: string): void {
    if (rules === this.#themeRules) return;
    this.#themeRules = rules;
    this.#themeSheet.replaceSync(rules);
  }

  #readTree(): void {
    const { roots, selectedValue } = readTree(this);
    this.#defaultValue = selectedValue ?? '';
    this.#controller.setTree(roots);
    this.#controller.setValue(this.#wantedValue ?? this.#defaultValue);
    this.#syncFormValue();
  }

  #syncFormValue(): void {
    this.#internals.setFormValue(this.value);
  }

  /**
   * Gives the core the numbers it cannot know: the size of the component, the
   * minimum widths in pixels and the geometry of the items of each column.
   * The core asks for a new draw only if they changed.
   */
  #measure(): void {
    const columns = this._columns;
    if (columns === null || !this.isConnected) return;

    // Measuring can ask for a draw, which measures again. The core makes this
    // settle in a pass or two; if it ever did not, the page would freeze, because
    // Lit draws in microtasks and the browser would never get to run a task.
    // So stop for this turn after a few passes, and let the browser breathe.
    if (this.#measurePasses === 0) {
      setTimeout(() => {
        this.#measurePasses = 0;
      });
    }
    this.#measurePasses += 1;
    if (this.#measurePasses > MAX_MEASURE_PASSES) {
      if (this.#measurePasses === MAX_MEASURE_PASSES + 1) {
        console.warn('<liana-select>: measuring did not settle; please report this.');
      }
      return;
    }

    // Everything is read from bounding rectangles, which are fractional. Mixing
    // them with clientHeight, which is rounded, would invent a tiny overflow.
    const bounds = columns.getBoundingClientRect();
    this.#controller.setSize(bounds.width, bounds.height);
    this.#controller.setOptions({
      minContentWidth: this._minProbe?.getBoundingClientRect().width ?? 0,
      collapsedMinWidth: this._collapsedProbe?.getBoundingClientRect().width ?? 0,
    });

    const metrics = new Map<string, ColumnMetrics>();
    for (const column of columns.querySelectorAll<HTMLElement>('.column')) {
      const content = column.firstElementChild;
      const key = column.dataset.key;
      if (content === null || key === undefined) continue;
      const contentTop = content.getBoundingClientRect().top;
      metrics.set(key, {
        height: bounds.height,
        items: Array.from(content.children, (item) => {
          const rect = item.getBoundingClientRect();
          return { top: rect.top - contentTop, height: rect.height };
        }),
      });
    }
    this.#controller.setMetrics(metrics);
  }

  /** Pointer position relative to the top left corner of the columns area. */
  #localPoint(event: PointerEvent): [x: number, y: number] {
    const rect = (this._columns ?? this).getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#pointerId !== undefined || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.matches(':disabled')) return;

    this.#pointerId = event.pointerId;
    // Keep receiving the events when the pointer leaves the component.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A synthetic event, as dispatched by testing tools, has no real pointer
      // to capture. The gesture still works while the pointer stays inside.
    }
    this.#controller.pointerDown(...this.#localPoint(event));
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#controller.pointerMove(...this.#localPoint(event));
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#controller.pointerMove(...this.#localPoint(event));
    this.#pointerId = undefined;
    this.#controller.pointerUp();
  };

  readonly #onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) return;
    this.#cancelGesture();
  };

  #cancelGesture(): void {
    this.#pointerId = undefined;
    this.#controller.pointerCancel();
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    // A key press makes the focus visible, even if a click brought it here.
    this.#setFocusVisible(true);

    const isCharacter = event.key.length === 1;
    // A space while typing a search is part of the search, not a confirmation.
    if (isCharacter && (event.key !== ' ' || this.#typed !== '')) {
      this.#type(event.key);
      event.preventDefault();
      return;
    }

    const action = KEY_ACTIONS[event.key];
    if (action === undefined) return;
    this.#clearTyped();
    const handled = this.#controller.keyboard(action);
    // Keys that would otherwise scroll the page are always consumed. Escape is
    // consumed only when it cancelled something, so that it can close a dialog.
    if (handled || action !== 'cancel') event.preventDefault();
  };

  #type(character: string): void {
    clearTimeout(this.#typedTimer);
    this.#typed += character;
    this.#controller.typeahead(this.#typed);
    this.#typedTimer = setTimeout(() => {
      this.#typed = '';
    }, TYPEAHEAD_TIMEOUT);
  }

  #clearTyped(): void {
    clearTimeout(this.#typedTimer);
    this.#typed = '';
  }

  readonly #onFocus = (event: FocusEvent): void => {
    // The ring is about to show: make sure it has the browser's current colour.
    this.#updateTheme();
    const target = event.currentTarget as HTMLElement;
    // Show the cursor only when the focus came from the keyboard, not a click.
    if (target.matches(':focus-visible')) {
      this.#setFocusVisible(true);
      this.#controller.keyboardFocus();
    }
  };

  readonly #onBlur = (): void => {
    // Switching to another window or tab blurs the element too, but the user has
    // not left it: the navigation goes on when they come back.
    if (!document.hasFocus()) return;
    this.#setFocusVisible(false);
    this.#clearTyped();
    this.#controller.keyboardBlur();
  };

  /** Toggles the `focus-visible` custom state, which draws the focus ring. */
  #setFocusVisible(visible: boolean): void {
    try {
      if (visible) this.#internals.states.add('focus-visible');
      else this.#internals.states.delete('focus-visible');
    } catch {
      // Custom states are not supported: there is no ring, nothing else changes.
    }
  }
}

// The element draws, measures what it drew, and may have to draw again: the
// second draw can only be scheduled as a side effect of the first. This is the
// case Lit's development warning tells to opt out for.
LianaSelect.disableWarning?.('change-in-update');

declare global {
  interface HTMLElementTagNameMap {
    'liana-select': LianaSelect;
  }
}
