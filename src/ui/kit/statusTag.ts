import { el } from './dom';

/** How a status tag reads: quiet (all is well) or alert (needs the player's attention). */
export type StatusTagTone = 'quiet' | 'alert';

/** A tiny parchment tag with a margin dot, for short live status (the camera chip). */
export function statusTag(text: string, tone: StatusTagTone = 'quiet'): HTMLElement {
  const tag = el('span', 'wg-status-tag');
  tag.setAttribute('role', 'status');
  tag.append(el('span', 'wg-status-tag__paper'), el('span', 'wg-status-tag__mark'));
  tag.append(el('span', 'wg-status-tag__text'));
  setStatusTag(tag, text, tone);
  return tag;
}

/** Updates a status tag's words and tone in place. */
export function setStatusTag(tag: HTMLElement, text: string, tone: StatusTagTone): void {
  const words = tag.querySelector('.wg-status-tag__text');
  if (words && words.textContent !== text) words.textContent = text;
  tag.classList.toggle('wg-status-tag--alert', tone === 'alert');
}
