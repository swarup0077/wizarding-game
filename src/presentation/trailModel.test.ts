import { describe, expect, it } from 'vitest';
import { TRAIL } from '../config/tuning';
import { buildTrail, energyForSpeed, fade, smoothToward, taper } from './trailModel';

const line = (hz: number, fromT: number, toT: number, speed = 1) => {
  const samples = [];
  for (let t = fromT; t <= toT; t += 1000 / hz) samples.push({ x: (t / 1000) * speed, y: 0.5, t });
  return samples;
};

describe('buildTrail', () => {
  it('lists points head first with ages growing toward the tail', () => {
    const samples = line(30, 0, 1000);
    const points = buildTrail(samples, samples[samples.length - 1]?.t ?? 0, 1);
    expect(points[0]?.age).toBeCloseTo(0, 6);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]?.age ?? 0).toBeGreaterThanOrEqual(points[i - 1]?.age ?? 0);
    }
  });

  it('drops everything older than the fade time', () => {
    const points = buildTrail(line(30, 0, 1000), 1000, 1);
    expect(Math.max(...points.map((p) => p.age))).toBeLessThan(TRAIL.fadeMs);
  });

  it('interpolates the head exactly at the render time between samples', () => {
    const points = buildTrail(line(30, 0, 1000), 500, 1);
    expect(points[0]?.x).toBeCloseTo(0.5, 3);
    expect(points[0]?.age).toBe(0);
  });

  it('places points densely even when samples are far apart (30 Hz, fast)', () => {
    const points = buildTrail(line(30, 0, 300, 10), 300, 1);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const gap = Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
      expect(gap).toBeLessThanOrEqual(TRAIL.subdivisionStep * 1.5);
    }
  });

  it('fades out a finished stroke as time passes', () => {
    const samples = line(30, 0, 500);
    expect(buildTrail(samples, 600, 1).length).toBeGreaterThan(0);
    expect(buildTrail(samples, 500 + TRAIL.fadeMs + 1, 1)).toHaveLength(0);
  });
});

describe('trail shape and energy', () => {
  it('taper and fade fall steadily from head to tail and reach zero', () => {
    for (const f of [taper, fade]) {
      expect(f(0)).toBe(1);
      expect(f(1)).toBe(0);
      for (let k = 0.05; k <= 1; k += 0.05) expect(f(k)).toBeLessThanOrEqual(f(k - 0.05));
    }
  });

  it('energy is 0 when calm, 1 when energetic, and rises with speed', () => {
    expect(energyForSpeed(0)).toBe(0);
    expect(energyForSpeed(TRAIL.calmSpeed)).toBe(0);
    expect(energyForSpeed(TRAIL.energeticSpeed * 2)).toBe(1);
    expect(energyForSpeed(1)).toBeGreaterThan(energyForSpeed(0.6));
  });

  it('smoothing approaches the target without overshoot, the same at any frame rate', () => {
    let at60 = 0;
    for (let i = 0; i < 6; i++) at60 = smoothToward(at60, 1, 1000 / 60, 100);
    let at30 = 0;
    for (let i = 0; i < 3; i++) at30 = smoothToward(at30, 1, 1000 / 30, 100);
    expect(at60).toBeCloseTo(at30, 10);
    expect(at60).toBeLessThan(1);
  });
});
