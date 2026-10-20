// Reusable SVG filters for the UI kit, injected once into the page as a hidden <svg>.
// Procedural only (feTurbulence and friends): no image files (NFR-8).
// Rule (ART_DIRECTION.md): filters go on elements that don't animate, so the browser
// renders them once; animations change only transform and opacity.

const FILTERS_ID = 'wg-ui-filters';

const DEFS = `
<svg id="${FILTERS_ID}" width="0" height="0" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <!-- Rough, slightly torn paper edge: noise displaces the element's outline. -->
    <filter id="wg-rough-edge" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <!-- Wax: an irregular poured rim. -->
    <filter id="wg-wax-rim" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="B"/>
    </filter>
    <!-- Ink soaking into paper: a soft spread used under fresh text. -->
    <filter id="wg-ink-bleed" x="-10%" y="-30%" width="120%" height="160%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
</svg>`;

/** Adds the kit's SVG filters to the page once. Safe to call many times. */
export function ensureUiFilters(doc: Document = document): void {
  if (doc.getElementById(FILTERS_ID)) return;
  doc.body.insertAdjacentHTML('afterbegin', DEFS);
}
