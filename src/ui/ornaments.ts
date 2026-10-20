// Original SVG ornaments for the UI kit, drawn for this project (no traced or borrowed art).
// The seal mark is a generic star over a wand: no crest, letter or logo (ART_DIRECTION.md).

/** Marks that can be pressed into a wax seal. */
export type SealMark = 'star' | 'wand';

/** A five-pointed star above a slim wand, for the seal's centre. Uses `currentColor`. */
const STAR_WAND = `
<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <path d="M20 4 l2.6 6.4 6.9 .5 -5.3 4.4 1.7 6.7 -5.9-3.7 -5.9 3.7 1.7-6.7 -5.3-4.4 6.9-.5z"
        fill="currentColor"/>
  <path d="M11 35 L24.5 22.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="25.6" cy="21.4" r="1.4" fill="currentColor"/>
</svg>`;

/** An eight-pointed compass star with a dot at its heart. Uses `currentColor`. */
const STAR = `
<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <path d="M20 3 L23 17 L37 20 L23 23 L20 37 L17 23 L3 20 L17 17 Z" fill="currentColor"/>
  <path d="M20 10 L22 18 L30 20 L22 22 L20 30 L18 22 L10 20 L18 18 Z"
        fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6" transform="rotate(45 20 20)"/>
  <circle cx="20" cy="20" r="2.2" fill="currentColor"/>
</svg>`;

/** SVG markup for a seal mark. */
export function sealMarkSvg(mark: SealMark): string {
  return mark === 'wand' ? STAR_WAND : STAR;
}

/**
 * A gilded corner flourish (top-left orientation; rotate for the other corners):
 * a scrolling curl with two small leaves, drawn in gold gradients.
 */
export const CORNER_FLOURISH = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="wg-gilt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8e3a6"/>
      <stop offset="0.45" stop-color="#e2b75a"/>
      <stop offset="1" stop-color="#6e4b17"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke="url(#wg-gilt)" stroke-linecap="round">
    <path d="M4 60 C4 30 14 12 34 6 C46 2 58 4 60 4" stroke-width="3.2"/>
    <path d="M10 46 C12 30 22 20 34 16 C42 13 48 16 46 22 C44 27 37 26 37 21" stroke-width="2"/>
    <path d="M22 54 C20 44 24 36 30 32" stroke-width="1.4"/>
  </g>
  <g fill="url(#wg-gilt)">
    <path d="M30 32 C33 27 38 26 41 28 C37 30 34 32 30 32 Z"/>
    <path d="M44 9 C47 5 52 5 55 7 C51 9 48 10 44 9 Z"/>
    <circle cx="4" cy="60" r="2.6"/>
    <circle cx="60" cy="4" r="2.6"/>
  </g>
</svg>`;

/** A thin calligraphic rule with a centre diamond, for dividing a page. Uses `currentColor`. */
export const PAGE_RULE = `
<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M2 6 C60 3 80 6 92 6 M108 6 C120 6 140 9 198 6" stroke="currentColor"
        stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <path d="M100 1 L105 6 L100 11 L95 6 Z" fill="currentColor"/>
</svg>`;
