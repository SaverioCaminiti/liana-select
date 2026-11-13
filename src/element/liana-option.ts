/**
 * `<liana-option>`: a selectable leaf of the tree of a `<liana-select>`.
 *
 * It only carries data: the parent `<liana-select>` reads it and draws it.
 * Its label is its text content, unless a `label` attribute is given.
 */
export class LianaOption extends HTMLElement {
  /** The value submitted when this option is selected; defaults to the label. */
  get value(): string {
    return this.getAttribute('value') ?? this.label;
  }
  set value(value: string) {
    this.setAttribute('value', value);
  }

  get label(): string {
    return this.getAttribute('label') ?? collapseWhitespace(this.textContent);
  }
  set label(label: string) {
    this.setAttribute('label', label);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(disabled: boolean) {
    this.toggleAttribute('disabled', disabled);
  }

  /** Whether this option is the initial selection, like the `selected` attribute of `<option>`. */
  get selected(): boolean {
    return this.hasAttribute('selected');
  }
  set selected(selected: boolean) {
    this.toggleAttribute('selected', selected);
  }
}

export function collapseWhitespace(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

if (!customElements.get('liana-option')) {
  customElements.define('liana-option', LianaOption);
}

declare global {
  interface HTMLElementTagNameMap {
    'liana-option': LianaOption;
  }
}
