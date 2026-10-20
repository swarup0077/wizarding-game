import { describe, expect, it } from 'vitest';
import themeCss from './theme.css?raw';
import { readTokens, resolveToken, usedTokens } from './themeTokens';

// Every stylesheet in the UI kit, the HUD and the dev tools, read as text by Vite.
const sheets = import.meta.glob<string>(
  ['/src/ui/**/*.css', '/src/presentation/**/*.css', '/src/dev/**/*.css'],
  { query: '?raw', import: 'default', eager: true },
);

describe('design tokens', () => {
  const all = Object.values(sheets).join('\n');

  it('finds the stylesheets', () => {
    expect(Object.keys(sheets).length).toBeGreaterThanOrEqual(8);
  });

  it('every var(--x) used in a stylesheet is defined somewhere', () => {
    const defined = readTokens(all);
    const missing = [...usedTokens(all)].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it('house colours default to neutral gold until the Sorting', () => {
    const theme = readTokens(themeCss);
    expect(resolveToken(theme, '--house-primary')).toBe(resolveToken(theme, '--gold-600'));
    expect(resolveToken(theme, '--house-secondary')).toBe(resolveToken(theme, '--gold-800'));
  });

  it('reads, finds and resolves tokens', () => {
    const css = ':root { --a: #fff; --b: var(--a); } .x { color: var(--b); }';
    expect(readTokens(css).get('--a')).toBe('#fff');
    expect([...usedTokens(css)]).toEqual(['--a', '--b']);
    expect(resolveToken(readTokens(css), '--b')).toBe('#fff');
  });
});
