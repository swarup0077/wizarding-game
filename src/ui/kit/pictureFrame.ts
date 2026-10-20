import type { PreviewFrame } from '../../core/settingsTypes';
import { CORNER_FLOURISH } from '../ornaments';
import { el, svgSpan } from './dom';

// A frame around a picture (the webcam preview). Every style shares this one DOM: the
// window, four corner flourishes and a name plate. Each style is a `.wg-frame--<name>` block
// in frame.css that decides what to show, so a new style is CSS only (plus its name in
// PREVIEW_FRAMES).

/** What the frame shows. */
export interface PictureFrameOptions {
  style: PreviewFrame;
  /** Text on the name plate, for styles that show one. */
  plate?: string;
}

/** A framed picture around `content` (a video, canvas or placeholder). */
export function pictureFrame(content: HTMLElement, options: PictureFrameOptions): HTMLElement {
  const frame = el('figure', 'wg-frame');
  const canvas = el('div', 'wg-frame__canvas');
  canvas.append(content);
  frame.append(canvas);
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    frame.append(svgSpan(`wg-frame__corner wg-frame__corner--${corner}`, CORNER_FLOURISH));
  }
  if (options.plate) frame.append(el('figcaption', 'wg-frame__plate', options.plate));
  setFrameStyle(frame, options.style);
  return frame;
}

/** Switches a frame to another style in place (no rebuild). */
export function setFrameStyle(frame: HTMLElement, style: PreviewFrame): void {
  for (const name of [...frame.classList]) {
    if (name.startsWith('wg-frame--')) frame.classList.remove(name);
  }
  frame.classList.add(`wg-frame--${style}`);
}
