import { describe, expect, it } from 'vitest';
import { catmullRom, reflectEnd } from './catmullRom';

const p = (x: number, y: number) => ({ x, y });

describe('catmullRom (centripetal)', () => {
  it('passes through its two middle control points', () => {
    const [a, b, c, d] = [p(0, 0), p(1, 1), p(2, 0), p(3, 1)];
    expect(catmullRom(a, b, c, d, 0).x).toBeCloseTo(1);
    expect(catmullRom(a, b, c, d, 0).y).toBeCloseTo(1);
    expect(catmullRom(a, b, c, d, 1).x).toBeCloseTo(2);
    expect(catmullRom(a, b, c, d, 1).y).toBeCloseTo(0);
  });

  it('keeps collinear points on their line', () => {
    for (const u of [0.1, 0.5, 0.9]) {
      const q = catmullRom(p(0, 0), p(1, 1), p(2, 2), p(3, 3), u);
      expect(q.y).toBeCloseTo(q.x, 10);
    }
  });

  it('does not overshoot or loop with very uneven spacing (1:10)', () => {
    const [a, b, c, d] = [p(0, 0), p(0.1, 0), p(1.1, 0.05), p(1.2, 0.05)];
    for (let i = 0; i <= 20; i++) {
      const q = catmullRom(a, b, c, d, i / 20);
      expect(q.x).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(q.x).toBeLessThanOrEqual(1.1 + 1e-9);
      expect(q.y).toBeGreaterThanOrEqual(-0.01);
      expect(q.y).toBeLessThanOrEqual(0.06);
    }
  });

  it('handles repeated points without dividing by zero', () => {
    const q = catmullRom(p(1, 1), p(1, 1), p(1, 1), p(1, 1), 0.5);
    expect(q.x).toBeCloseTo(1, 12);
    expect(q.y).toBeCloseTo(1, 12);
  });

  it('reflects an end point to continue the end segment', () => {
    expect(reflectEnd(p(1, 1), p(0, 0))).toEqual(p(2, 2));
  });
});
