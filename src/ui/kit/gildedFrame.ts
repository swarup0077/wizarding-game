import { CORNER_FLOURISH } from '../ornaments';
import { el, svgSpan } from './dom';

/** An ornate gilded frame around `content` (the webcam preview becomes a moving portrait). */
export function gildedFrame(content: HTMLElement, plate?: string): HTMLElement {
  const frame = el('figure', 'wg-frame');
  const canvas = el('div', 'wg-frame__canvas');
  canvas.append(content);
  frame.append(canvas);
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    frame.append(svgSpan(`wg-frame__corner wg-frame__corner--${corner}`, CORNER_FLOURISH));
  }
  if (plate) frame.append(el('figcaption', 'wg-frame__plate', plate));
  return frame;
}
