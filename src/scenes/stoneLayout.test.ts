import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../core/seededRandom';
import { stoneLayout } from './stoneLayout';

const options = { stoneHeight: 0.085, stoneWidthMin: 0.12, stoneWidthMax: 0.24 };

describe('stoneLayout', () => {
  it.each([16 / 9, 4 / 3, 0.5, 2.4])('covers a stage of aspect %f with no gaps', (aspect) => {
    const stones = stoneLayout(aspect, createSeededRandom(1729), options);
    const rows = new Map<number, typeof stones>();
    for (const s of stones) rows.set(s.y, [...(rows.get(s.y) ?? []), s]);

    const rowTops = [...rows.keys()].sort((a, b) => a - b);
    expect(rowTops[0]).toBe(0);
    const lastTop = rowTops[rowTops.length - 1] ?? 0;
    expect(lastTop + (rows.get(lastTop)?.[0]?.h ?? 0)).toBeGreaterThanOrEqual(1);

    for (const row of rows.values()) {
      const first = row[0];
      const last = row[row.length - 1];
      expect(first?.x).toBeLessThanOrEqual(0);
      expect((last?.x ?? 0) + (last?.w ?? 0)).toBeGreaterThanOrEqual(aspect);
      for (let i = 1; i < row.length; i++) {
        const prev = row[i - 1];
        expect(row[i]?.x).toBeCloseTo((prev?.x ?? 0) + (prev?.w ?? 0), 12);
      }
    }
  });

  it('keeps stone widths and tones in range', () => {
    for (const s of stoneLayout(16 / 9, createSeededRandom(3), options)) {
      expect(s.w).toBeGreaterThanOrEqual(options.stoneWidthMin);
      expect(s.w).toBeLessThanOrEqual(options.stoneWidthMax);
      expect(Math.abs(s.tone)).toBeLessThanOrEqual(0.5);
    }
  });

  it('is identical for the same seed', () => {
    expect(stoneLayout(1.5, createSeededRandom(9), options)).toEqual(
      stoneLayout(1.5, createSeededRandom(9), options),
    );
  });

  it('varies row heights within the allowed range, with rows stacked edge to edge', () => {
    const varied = { ...options, rowHeightVariation: 0.15 };
    const stones = stoneLayout(16 / 9, createSeededRandom(1729), varied);
    const rows = [...new Map(stones.map((s) => [s.y, s.h])).entries()].sort((a, b) => a[0] - b[0]);
    const heights = rows.map(([, h]) => h);
    expect(new Set(heights).size).toBeGreaterThan(1);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(options.stoneHeight * 0.85 - 1e-12);
      expect(h).toBeLessThanOrEqual(options.stoneHeight * 1.15 + 1e-12);
    }
    rows.forEach(([top], i) => {
      const prev = rows[i - 1];
      if (prev) expect(top).toBeCloseTo(prev[0] + prev[1], 12);
    });
  });
});
