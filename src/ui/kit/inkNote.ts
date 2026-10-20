import { el } from './dom';

/** How serious a note is; it sets the margin mark. */
export type InkNoteLevel = 'info' | 'warn' | 'error';

/** A small torn slip of parchment whose words bleed in (toasts). */
export function inkNote(text: string, level: InkNoteLevel, action?: HTMLElement): HTMLElement {
  const note = el('div', `wg-ink-note wg-ink-note--${level} wg-ink-in`);
  note.setAttribute('role', level === 'error' ? 'alert' : 'status');
  const words = el('p', 'wg-ink-note__text', text);
  words.dataset['text'] = text; // the blurred copy used by the ink-bleed entrance
  note.append(el('span', 'wg-ink-note__paper'), words);
  if (action) {
    action.classList.add('wg-ink-note__action');
    words.append(action);
  }
  return note;
}
