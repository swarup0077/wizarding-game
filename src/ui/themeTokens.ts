// Reads CSS custom properties out of stylesheet text (used by tests and the dev gallery).

/** Every `--name: value;` declaration in `css`, as a name → value map (last one wins). */
export function readTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

/** Every `var(--name)` used in `css`. */
export function usedTokens(css: string): Set<string> {
  return new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1] ?? ''));
}

/** Follows `var(--x)` references until a literal value (or undefined if unresolvable). */
export function resolveToken(tokens: Map<string, string>, name: string): string | undefined {
  let value = tokens.get(name);
  for (let hops = 0; value?.startsWith('var(') && hops < 10; hops++) {
    value = tokens.get(value.slice(4, -1).trim());
  }
  return value;
}
