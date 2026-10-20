/** Creates an element with a class and, optionally, text (always set as text, never HTML). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Creates a span holding one of the kit's own fixed SVG strings. */
export function svgSpan(className: string, svg: string): HTMLSpanElement {
  const span = el('span', className);
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svg; // trusted: only the kit's own constant SVG markup comes here
  return span;
}
