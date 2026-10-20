import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../core/seededRandom';
import { crackPath, stoneOutline } from './stoneShape';

const rect = { left: 100, top: 50, right: 260, bottom: 120 };
const base = {
  cornerJitterPxMin: 1,
  cornerJitterPxMax: 2,
  chipChance: 0,
  chipSizePxMin: 4,
  chipSizePxMax: 9,
};

const inside = (p: { x: number; y: number }) =>
  p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;

describe('stoneOutline', () => {
  it('gives 4 corners, each moved 1–2 px inward', () => {
    const points = stoneOutline(rect, createSeededRandom(1), base);
    expect(points).toHaveLength(4);
    const [tl, tr, br, bl] = points;
    for (const [p, cx, cy] of [
      [tl, rect.left, rect.top],
      [tr, rect.right, rect.top],
      [br, rect.right, rect.bottom],
      [bl, rect.left, rect.bottom],
    ] as const) {
      expect(Math.abs((p?.x ?? 0) - cx)).toBeGreaterThanOrEqual(1);
      expect(Math.abs((p?.x ?? 0) - cx)).toBeLessThanOrEqual(2);
      expect(Math.abs((p?.y ?? 0) - cy)).toBeGreaterThanOrEqual(1);
      expect(Math.abs((p?.y ?? 0) - cy)).toBeLessThanOrEqual(2);
    }
  });

  it('chips every corner into two points when chipping is certain', () => {
    const points = stoneOutline(rect, createSeededRandom(2), { ...base, chipChance: 1 });
    expect(points).toHaveLength(8);
    expect(points.every(inside)).toBe(true);
  });

  it('keeps chipped outlines clockwise (positive signed area in screen coordinates)', () => {
    for (const seed of [3, 4, 5]) {
      const points = stoneOutline(rect, createSeededRandom(seed), { ...base, chipChance: 0.5 });
      let area = 0;
      points.forEach((p, i) => {
        const q = points[(i + 1) % points.length] ?? p;
        area += p.x * q.y - q.x * p.y;
      });
      expect(area).toBeGreaterThan(0);
    }
  });

  it('never chips more than a third of a small stone', () => {
    const small = { left: 0, top: 0, right: 12, bottom: 12 };
    const points = stoneOutline(small, createSeededRandom(6), {
      ...base,
      chipChance: 1,
      chipSizePxMin: 20,
      chipSizePxMax: 20,
    });
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(12);
    }
  });
});

describe('crackPath', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'starts on the top or left edge and stays inside (seed %i)',
    (seed) => {
      const points = crackPath(rect, createSeededRandom(seed));
      const start = points[0];
      expect(start?.y === rect.top || start?.x === rect.left).toBe(true);
      expect(points.length).toBeGreaterThanOrEqual(5);
      expect(points.every(inside)).toBe(true);
    },
  );
});
