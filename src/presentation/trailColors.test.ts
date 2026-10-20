import { describe, expect, it } from 'vitest';
import {
  mixRgb,
  quantizeRgb,
  reachableTrailColors,
  type Rgb,
  sparkleSpriteColor,
  spriteColor,
  trailColor,
} from './trailColors';

const brightness = (c: Rgb) => c[0] + c[1] + c[2];

describe('trail colours', () => {
  it('is gold-white at the head and darker amber at the tail', () => {
    const head = trailColor(0, 0, 'fade', 0);
    const tail = trailColor(1, 0, 'fade', 0);
    expect(brightness(head)).toBeGreaterThan(brightness(tail));
    expect(head[0]).toBeGreaterThanOrEqual(head[2]);
  });

  it('energy makes the head whiter', () => {
    expect(trailColor(0, 1, 'fade', 0)[2]).toBeGreaterThan(trailColor(0, 0, 'fade', 0)[2]);
  });

  it('a grey release drains the colour', () => {
    const grey = trailColor(0.5, 0, 'grey', 1);
    expect(Math.max(...grey) - Math.min(...grey)).toBeLessThan(30);
  });

  it('mixes and quantizes within 0–255', () => {
    expect(mixRgb([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(quantizeRgb([254, 7, 130])).toEqual([252, 12, 132]);
  });
});

describe('reachableTrailColors', () => {
  it('covers every sprite colour the trail can ask for (no sprite built mid-stroke)', () => {
    const { glow, sparkle } = reachableTrailColors();
    const known = new Set(glow.map((c) => quantizeRgb(c).join(',')));
    const knownSparkles = new Set(sparkle.map((c) => quantizeRgb(c).join(',')));
    const random = (() => {
      let s = 42;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    })();
    for (let i = 0; i < 20000; i++) {
      const outcome = (['fade', 'grey', 'gold'] as const)[i % 3] ?? 'fade';
      const energy = outcome === 'grey' ? 0 : random();
      const release = outcome === 'fade' ? 0 : outcome === 'gold' ? 1 : random();
      const c = spriteColor(random(), energy, outcome, release);
      expect(known.has(quantizeRgb(c).join(','))).toBe(true);
      expect(knownSparkles.has(quantizeRgb(sparkleSpriteColor(random())).join(','))).toBe(true);
    }
  });
});
