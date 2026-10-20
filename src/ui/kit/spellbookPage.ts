import type { Vec2 } from '../../core/types';
import { el } from './dom';
import { shapeGeometry } from './shapeGeometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOX = 160;
const PAD = 16;

/** What a spellbook page shows. */
export interface SpellbookPageOptions {
  /** Spell id, used for the spell's colour identity ('lumos', 'leviosa', 'incendio'). */
  spellId: string;
  name: string;
  pronunciation: string;
  /** The shape in a unit box, y down, in drawing order. */
  shape: Vec2[];
  hint?: string;
  /** Draw the shape in ink as the page appears. */
  animate?: boolean;
}

/** A spellbook page (spell card): name, pronunciation, and the shape with start and direction. */
export function spellbookPage(options: SpellbookPageOptions): HTMLElement {
  const page = el('article', 'wg-spellbook-page');
  page.dataset['spell'] = options.spellId;
  if (options.animate) page.classList.add('wg-ink-in');
  page.append(
    el('div', 'wg-spellbook-page__paper'),
    el('h3', 'wg-spellbook-page__name', options.name),
    el('p', 'wg-spellbook-page__pronunciation', options.pronunciation),
    shapeSvg(options.shape),
  );
  if (options.hint) page.append(el('p', 'wg-spellbook-page__hint', options.hint));
  return page;
}

function shapeSvg(shape: Vec2[]): SVGSVGElement {
  const geometry = shapeGeometry(shape, BOX, PAD);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'wg-spellbook-page__shape');
  svg.setAttribute('viewBox', `0 0 ${BOX} ${BOX}`);
  svg.setAttribute('aria-hidden', 'true');

  const stroke = document.createElementNS(SVG_NS, 'path');
  stroke.setAttribute('class', 'wg-spellbook-page__stroke');
  stroke.setAttribute('d', geometry.d);
  stroke.setAttribute('pathLength', '1'); // lets the quill animation use 0–1 dash offsets

  const start = document.createElementNS(SVG_NS, 'circle');
  start.setAttribute('class', 'wg-spellbook-page__start');
  start.setAttribute('cx', geometry.start.x.toFixed(1));
  start.setAttribute('cy', geometry.start.y.toFixed(1));
  start.setAttribute('r', '5');

  const arrow = document.createElementNS(SVG_NS, 'path');
  arrow.setAttribute('class', 'wg-spellbook-page__arrow');
  arrow.setAttribute('d', 'M 7 0 L -5 -5.5 L -2 0 L -5 5.5 Z');
  const { x, y, angleDeg } = geometry.arrow;
  arrow.setAttribute(
    'transform',
    `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`,
  );

  svg.append(stroke, start, arrow);
  return svg;
}
