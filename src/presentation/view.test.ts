import { describe, expect, it } from 'vitest';
import { createView } from './view';

describe('View', () => {
  it.each([
    [1920, 1080],
    [1024, 768],
    [390, 844],
  ])('round-trips normalized ↔ pixels at %i×%i', (w, h) => {
    const view = createView(w, h);
    for (const p of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.25, y: 0.8 },
      { x: 0.5, y: 0.5 },
    ]) {
      const back = view.fromPx(view.toPx(p));
      expect(back.x).toBeCloseTo(p.x, 12);
      expect(back.y).toBeCloseTo(p.y, 12);
    }
  });

  it('maps corners to the stage edges', () => {
    const view = createView(1600, 900);
    expect(view.toPx({ x: 1, y: 1 })).toEqual({ x: 1600, y: 900 });
    expect(view.fromPx({ x: 800, y: 450 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('reports aspect as width / height', () => {
    expect(createView(1600, 900).aspect).toBeCloseTo(16 / 9);
  });

  it('measures square units against the stage height', () => {
    const view = createView(1600, 900);
    expect(view.lengthToPx(1)).toBe(900);
    expect(view.lengthToPx(0.12)).toBeCloseTo(108);
  });

  it('keeps the pixel ratio it was given', () => {
    expect(createView(800, 600, 1.5).pixelRatio).toBe(1.5);
  });

  it('never divides by zero for a zero-size stage', () => {
    const view = createView(0, 0);
    expect(view.aspect).toBe(1);
    expect(Number.isFinite(view.fromPx({ x: 5, y: 5 }).x)).toBe(true);
  });
});
