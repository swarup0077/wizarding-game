import { describe, expect, it } from 'vitest';
import { SPARKLES } from '../config/tuning';
import { createSeededRandom } from '../core/seededRandom';
import { sparkleCount, sparkleInit, twinkle } from './sparkles';

describe('sparkles', () => {
  it('emits per distance, carrying fractions so none are lost', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const r = sparkleCount(0.01, 0, carry);
      total += r.count;
      carry = r.carry;
    }
    expect(total + carry).toBeCloseTo(SPARKLES.perUnitCalm, 6);
  });

  it('emits nothing for a still wand', () => {
    expect(sparkleCount(0, 1, 0).count).toBe(0);
  });

  it('energetic strokes emit more sparkles that fly faster', () => {
    expect(sparkleCount(1, 1, 0).count).toBeGreaterThan(sparkleCount(1, 0, 0).count);
    const totalSpeed = (energy: number) => {
      const random = createSeededRandom(1);
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const s = sparkleInit({ x: 0, y: 0 }, energy, random);
        sum += Math.hypot(s.vx, s.vy);
      }
      return sum;
    };
    expect(totalSpeed(1)).toBeGreaterThan(totalSpeed(0) * 3);
  });

  it('twinkle stays within its depth', () => {
    for (let t = 0; t < 1000; t += 7) {
      const v = twinkle(t, 1.3);
      expect(v).toBeGreaterThanOrEqual(1 - SPARKLES.twinkleDepth - 1e-9);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
