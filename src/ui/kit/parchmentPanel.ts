import { PAGE_RULE } from '../ornaments';
import { el, svgSpan } from './dom';

/** What a parchment panel shows. */
export interface ParchmentPanelOptions {
  title?: string;
  body?: string;
  /** Small italic line under the body (e.g. a technical detail for bug reports). */
  fine?: string;
  actions?: HTMLElement[];
  /** Play the unroll entrance. */
  animate?: boolean;
}

/** A parchment panel: the base for messages, cards and letters. */
export function parchmentPanel(options: ParchmentPanelOptions): HTMLElement {
  const panel = el('section', 'wg-parchment');
  if (options.animate) panel.classList.add('wg-unroll');
  panel.append(el('div', 'wg-parchment__paper'));
  if (options.title) {
    panel.append(el('h2', 'wg-parchment__title', options.title));
    panel.append(svgSpan('wg-parchment__rule', PAGE_RULE));
  }
  if (options.body) panel.append(el('p', 'wg-parchment__body', options.body));
  if (options.fine) panel.append(el('p', 'wg-parchment__fine', options.fine));
  if (options.actions?.length) {
    const row = el('div', 'wg-parchment__actions');
    row.append(...options.actions);
    panel.append(row);
  }
  return panel;
}
