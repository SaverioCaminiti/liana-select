import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * `<liana-select>`: a select for picking an item from a tree of options.
 *
 * Placeholder only. Attributes, properties, events and the selection gesture
 * are not designed yet; the element will delegate all logic to `../core`.
 */
@customElement('liana-select')
export class LianaSelect extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
  `;

  override render() {
    return html`<span part="placeholder">liana-select</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'liana-select': LianaSelect;
  }
}
