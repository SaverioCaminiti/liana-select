/**
 * `<liana-group>`: a category in the tree of a `<liana-select>`. It contains
 * `<liana-option>` and further `<liana-group>` elements.
 *
 * It only carries data: the parent `<liana-select>` reads it and draws it.
 */
export class LianaGroup extends HTMLElement {
  get label(): string {
    return this.getAttribute('label') ?? '';
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
}

if (!customElements.get('liana-group')) {
  customElements.define('liana-group', LianaGroup);
}

declare global {
  interface HTMLElementTagNameMap {
    'liana-group': LianaGroup;
  }
}
