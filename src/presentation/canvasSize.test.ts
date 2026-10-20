import { describe, expect, it } from 'vitest';
import { backingSize, effectiveDpr, parseDprCapOverride } from './canvasSize';

describe('effectiveDpr', () => {
  it('uses the device ratio when it is under the cap', () => {
    expect(effectiveDpr(1.25, 1.5)).toBe(1.25);
  });

  it('caps a Retina ratio', () => {
    expect(effectiveDpr(2, 1.5)).toBe(1.5);
  });

  it('treats a missing or broken device ratio as 1', () => {
    expect(effectiveDpr(0, 1.5)).toBe(1);
    expect(effectiveDpr(Number.NaN, 1.5)).toBe(1);
  });
});

describe('backingSize', () => {
  it('scales and rounds CSS size by the ratio', () => {
    expect(backingSize(1366, 768, 1.25)).toEqual({ width: 1708, height: 960 });
    expect(backingSize(1440, 900, 1.5)).toEqual({ width: 2160, height: 1350 });
  });

  it('is never smaller than 1×1', () => {
    expect(backingSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

describe('parseDprCapOverride', () => {
  it('reads a valid cap', () => {
    expect(parseDprCapOverride('?dprCap=2')).toBe(2);
    expect(parseDprCapOverride('?foo=1&dprCap=1.25')).toBe(1.25);
  });

  it.each(['', '?dprCap=', '?dprCap=abc', '?dprCap=0.1', '?dprCap=9', '?other=2'])(
    'ignores %s',
    (search) => {
      expect(parseDprCapOverride(search)).toBeNull();
    },
  );
});
