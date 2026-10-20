import { type SealMark, sealMarkSvg } from '../ornaments';
import { el, svgSpan } from './dom';

/** A primary action: a wax seal with an original mark, and its label. */
export function waxSealButton(
  label: string,
  onClick: () => void,
  mark: SealMark = 'wand',
): HTMLButtonElement {
  const button = el('button', 'wg-seal-button');
  button.type = 'button';
  const seal = el('span', 'wg-seal');
  seal.setAttribute('aria-hidden', 'true');
  seal.append(el('span', 'wg-seal__wax'), svgSpan('wg-seal__mark', sealMarkSvg(mark)));
  button.append(seal, el('span', 'wg-seal-button__label', label));
  button.addEventListener('click', onClick);
  return button;
}

/** A secondary action, written in ink with a hand-drawn underline. */
export function inkLinkButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', 'wg-ink-link', label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}
