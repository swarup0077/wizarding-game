import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_CONTRAST_LARGE, MIN_CONTRAST_TEXT, parseHex } from './contrast';
import themeCss from './theme.css?raw';
import { readTokens, resolveToken } from './themeTokens';

const tokens = readTokens(themeCss);
const colour = (name: string): string => {
  const value = resolveToken(tokens, name);
  if (!value) throw new Error(`theme.css has no ${name}`);
  return value;
};
const ratio = (ink: string, paper: string): number => contrastRatio(colour(ink), colour(paper));

// Text colours and what they sit on. Parchment text is checked against the darkest
// parchment shade text can land on (--parchment-300), not just the light base.
const PARCHMENTS = ['--parchment-100', '--parchment-200', '--parchment-300'];
const BODY_ON_PARCHMENT = ['--ink-900', '--ink-700', '--ink-red', '--ink-green'];
const LARGE_ON_PARCHMENT = [
  '--grade-o',
  '--grade-e',
  '--grade-a',
  '--grade-p',
  '--spell-lumos-ink',
  '--spell-leviosa-ink',
  '--spell-incendio-ink',
];
const NIGHTS = ['--night-950', '--night-900', '--night-800', '--night-700'];

describe('contrast maths', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('rejects anything that is not a hex colour', () => {
    expect(() => parseHex('rgb(0,0,0)')).toThrow();
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
  });
});

describe('theme text contrast', () => {
  for (const ink of BODY_ON_PARCHMENT) {
    it(`${ink} reads as body text on every parchment shade`, () => {
      for (const paper of PARCHMENTS)
        expect(ratio(ink, paper)).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
    });
  }

  // The green handwritten address on the acceptance letter is held to the body-text bar
  // even though it is large: script strokes are thin, so large-text leniency would
  // overstate how readable it is.
  it('the green handwriting passes body-text contrast on every parchment shade', () => {
    for (const paper of PARCHMENTS) {
      expect(ratio('--ink-green', paper)).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
    }
  });

  for (const ink of LARGE_ON_PARCHMENT) {
    it(`${ink} reads as large text on every parchment shade`, () => {
      for (const paper of PARCHMENTS)
        expect(ratio(ink, paper)).toBeGreaterThanOrEqual(MIN_CONTRAST_LARGE);
    });
  }

  it('parchment-coloured text reads on the night stage', () => {
    for (const night of NIGHTS) {
      expect(ratio('--parchment-100', night)).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
    }
  });

  it('the name plate (ink on mid gold) reads as small label text', () => {
    expect(ratio('--ink-900', '--gold-400')).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
  });
});
