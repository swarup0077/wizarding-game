import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './seededRandom';

const take = (random: () => number, n: number) => Array.from({ length: n }, random);

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createSeededRandom(42), 20)).toEqual(take(createSeededRandom(42), 20));
  });

  it('gives a different sequence for a different seed', () => {
    expect(take(createSeededRandom(1), 20)).not.toEqual(take(createSeededRandom(2), 20));
  });

  it('stays in [0, 1) and spreads across the range', () => {
    const values = take(createSeededRandom(7), 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });
});
