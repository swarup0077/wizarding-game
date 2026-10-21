import { describe, expect, it } from 'vitest';
import { coverFit, toWindowPx } from './coverFit';

describe('coverFit', () => {
  it('a 4:3 video in a 4:3 window fills it exactly', () => {
    const fit = coverFit(640, 480, 320, 240);
    expect(fit).toEqual({ width: 320, height: 240, offsetX: 0, offsetY: 0 });
    expect(toWindowPx({ x: 0.25, y: 0.5 }, fit)).toEqual({ x: 80, y: 120 });
  });

  it('a 16:9 video in a 4:3 window is cut at the sides, centred', () => {
    const fit = coverFit(1280, 720, 320, 240);
    // Scaled to the window's height: 240 / 720 = 1/3 → 426.67 px wide, 53.33 px cut each side.
    expect(fit.height).toBeCloseTo(240);
    expect(fit.width).toBeCloseTo(426.667, 2);
    expect(fit.offsetX).toBeCloseTo(-53.333, 2);
    expect(fit.offsetY).toBeCloseTo(0);
    // The video's centre stays the window's centre; its edge falls outside the window.
    expect(toWindowPx({ x: 0.5, y: 0.5 }, fit).x).toBeCloseTo(160);
    expect(toWindowPx({ x: 0, y: 0 }, fit).x).toBeLessThan(0);
  });

  it('is symmetric, so mirrored points land where the mirrored video shows them', () => {
    const fit = coverFit(1280, 720, 320, 240);
    const a = toWindowPx({ x: 0.3, y: 0.4 }, fit);
    const b = toWindowPx({ x: 0.7, y: 0.4 }, fit);
    expect(a.x + b.x).toBeCloseTo(320);
  });

  it('a portrait video in a 4:3 window is cut at the top and bottom', () => {
    const fit = coverFit(480, 640, 320, 240);
    expect(fit.width).toBeCloseTo(320);
    expect(fit.offsetY).toBeLessThan(0);
  });

  it('before the video has a size, it maps onto the window', () => {
    expect(coverFit(0, 0, 320, 240)).toEqual({ width: 320, height: 240, offsetX: 0, offsetY: 0 });
  });
});
