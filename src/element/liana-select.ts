import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  LianaController,
  type ColumnMetrics,
  type ColumnView,
  type ItemView,
} from '../core/index';
import './liana-group';
import './liana-option';
import { readTree } from './read-tree';

/** Attributes of the child elements that change the tree. */
const TREE_ATTRIBUTES = ['value', 'label', 'disabled', 'selected'];

/**
 * `<liana-select>`: a select for picking one option from a tree, with a single
 * gesture or with one tap per level.
 *
 * The tree is declared with nested `<liana-group>` and `<liana-option>`
 * children. Inside a `<form>` it behaves like a native `<select>`: it has a
 * `name`, a `value`, and dispatches `input` and `change`.
 *
 * All the behaviour lives in the core (`LianaController`). This element reads
 * the markup, measures the DOM, forwards pointer events and draws the view.
 * See `docs/interaction-design.md`.
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
 * @cssprop --liana-highlight-color - Background of the item under the pointer.
 * @cssprop --liana-selected-color - Background of a selected item.
 */
@customElement('liana-select')
export class LianaSelect extends LitElement {
  static readonly formAssociated = true;

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
    }

    :host(:disabled) {
      opacity: 0.5;
      pointer-events: none;
    }

    .columns {
      display: flex;
      height: 100%;
      overflow: hidden;
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
      background: color-mix(in srgb, currentColor 15%, transparent);
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

    .item[data-state='highlighted'] {
      background: var(--liana-highlight-color, color-mix(in srgb, #2f9bff 35%, Field));
    }

    .item[data-state='selected'] {
      background: var(--liana-selected-color, color-mix(in srgb, #35b558 40%, Field));
    }

    .item[data-disabled] {
      opacity: 0.4;
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
      width: var(--liana-column-collapsed-min-width, 2rem);
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

  @query('.columns') private _columns!: HTMLElement | null;
  @query('.probe-min') private _minProbe!: HTMLElement | null;
  @query('.probe-collapsed') private _collapsedProbe!: HTMLElement | null;

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
    this.#readTree();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#treeObserver.disconnect();
    this.#resizeObserver.disconnect();
    this.#cancelGesture();
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
    const { columns } = this.#controller.view;
    return html`
      <div
        class="columns"
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @lostpointercapture=${this.#onPointerCancel}
      >
        ${repeat(
          columns,
          (column) => column.key,
          (column) => this.#renderColumn(column),
        )}
      </div>
      <div class="probe probe-min"></div>
      <div class="probe probe-collapsed"></div>
    `;
  }

  #renderColumn(column: ColumnView): TemplateResult {
    return html`
      <div
        class="column"
        part="column"
        data-key=${column.key}
        data-role=${column.role}
        style=${styleMap({ width: `${String(column.width)}px` })}
      >
        <div
          class="content"
          style=${styleMap({
            width: `${String(column.contentWidth)}px`,
            transform: `translateY(${String(-column.scroll)}px)`,
          })}
        >
          ${column.items.map((item) => this.#renderItem(item))}
        </div>
      </div>
    `;
  }

  #renderItem(item: ItemView): TemplateResult {
    return html`
      <div
        class="item"
        part="item"
        data-kind=${item.node.kind}
        data-state=${item.state}
        ?data-disabled=${item.node.disabled === true}
        data-value=${item.node.kind === 'option' ? item.node.value : nothing}
      >
        <span class="label">${item.node.label}</span>
      </div>
    `;
  }

  protected override updated(): void {
    this.#measure();
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

    this.#controller.setSize(columns.clientWidth, columns.clientHeight);
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
        height: column.clientHeight,
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
}

declare global {
  interface HTMLElementTagNameMap {
    'liana-select': LianaSelect;
  }
}
