import { describe, expect, it } from 'vitest';
import { createParticlePool, type ParticleInit, sparkleAlpha, sparkleScale } from './particles';

const init = (over: Partial<ParticleInit> = {}): ParticleInit => ({
  x: 0,
  y: 0,
  vx: 0.1,
  vy: 0,
  lifeMs: 500,
  size: 1,
  warmth: 0,
  phase: 0,
  ...over,
});
const physics = { drag: 2, float: 0.1 };

describe('particle pool', () => {
  it('never holds more than its capacity', () => {
    const pool = createParticlePool(10);
    let accepted = 0;
    for (let i = 0; i < 50; i++) if (pool.spawn(init())) accepted++;
    expect(accepted).toBe(10);
    expect(pool.aliveCount()).toBe(10);
  });

  it('reuses the same objects after particles die', () => {
    const pool = createParticlePool(3);
    const first = new Set<object>();
    for (let i = 0; i < 3; i++) pool.spawn(init());
    pool.forEachAlive((p) => first.add(p));
    pool.update(600, physics);
    expect(pool.aliveCount()).toBe(0);
    for (let i = 0; i < 3; i++) pool.spawn(init());
    const second: object[] = [];
    pool.forEachAlive((p) => second.push(p));
    expect(second.every((p) => first.has(p))).toBe(true);
  });

  it('moves particles, slows them with drag, and floats them upward', () => {
    const pool = createParticlePool(1);
    pool.spawn(init({ vx: 1, vy: 0 }));
    pool.update(100, physics);
    const seen: { x: number; vx: number; vy: number }[] = [];
    pool.forEachAlive((p) => seen.push(p));
    expect(seen[0]?.x).toBeGreaterThan(0);
    expect(seen[0]?.vx).toBeLessThan(1);
    expect(seen[0]?.vy).toBeLessThan(0);
  });
});

describe('sparkle fade', () => {
  it('fades in quickly, then out smoothly to exactly zero (never pops)', () => {
    expect(sparkleAlpha(0)).toBe(0);
    expect(sparkleAlpha(1)).toBe(0);
    let peak = 0;
    let prev = 0;
    for (let i = 0; i <= 100; i++) {
      const a = sparkleAlpha(i / 100);
      expect(Math.abs(a - prev)).toBeLessThan(0.15);
      peak = Math.max(peak, a);
      prev = a;
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(sparkleAlpha(0.97)).toBeLessThan(0.01);
  });

  it('shrinks as it fades', () => {
    expect(sparkleScale(0)).toBe(1);
    expect(sparkleScale(1)).toBeCloseTo(0.4);
  });
});
