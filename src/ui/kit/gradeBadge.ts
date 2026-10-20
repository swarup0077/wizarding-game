import { GRADE_WORDS, type Grade } from '../grades';
import { el } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Words longer than this use the smaller ring lettering so they fit the arc. */
const LONG_WORD = 11;
let ringId = 0;

/** A stamped grade badge: the letter, with its word around the top of the ring. */
export function gradeBadge(grade: Grade): HTMLElement {
  const word = GRADE_WORDS[grade];
  const badge = el('div', `wg-grade wg-grade--${grade}`);
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', `${grade}: ${word}`);

  const id = `wg-grade-ring-${++ringId}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'wg-grade__ring');
  svg.setAttribute('viewBox', '0 0 104 104');
  svg.setAttribute('aria-hidden', 'true');
  const arc = document.createElementNS(SVG_NS, 'path');
  arc.setAttribute('id', id);
  // A wide arc over the top: from lower left, round the top, to lower right.
  arc.setAttribute('d', 'M 22 74 A 37 37 0 1 1 82 74');
  arc.setAttribute('fill', 'none');
  const text = document.createElementNS(SVG_NS, 'text');
  if (word.length > LONG_WORD) text.classList.add('wg-grade__word--long');
  const along = document.createElementNS(SVG_NS, 'textPath');
  along.setAttribute('href', `#${id}`);
  along.setAttribute('startOffset', '50%');
  along.setAttribute('text-anchor', 'middle');
  along.textContent = word;
  text.append(along);
  svg.append(arc, text);

  badge.append(el('div', 'wg-grade__disc'), svg, el('span', 'wg-grade__letter', grade));
  return badge;
}
