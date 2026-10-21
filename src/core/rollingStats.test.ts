import { describe, expect, it } from 'vitest';
import { createRollingStats } from './rollingStats';

describe('rollingStats', () => {
  it('is all zeros when empty', () => {
    const stats = createRollingStats(10);
    expect(stats.count()).toBe(0);
    expect(stats.mean()).toBe(0);
    expect(stats.p95()).toBe(0);
  });

  it('gives the mean and the nearest-rank 95th percentile', () => {
    const stats = createRollingStats(100);
    for (let i = 1; i <= 100; i++) stats.add(i);
    expect(stats.mean()).toBeCloseTo(50.5);
    expect(stats.p95()).toBe(95);
  });

  it('a single slow sample shows in p95 but barely moves the mean', () => {
    const stats = createRollingStats(20);
    for (let i = 0; i < 19; i++) stats.add(10);
    stats.add(80);
    expect(stats.mean()).toBeCloseTo(13.5);
    expect(stats.p95()).toBe(10);
    stats.add(80);
    expect(stats.p95()).toBe(80);
  });

  it('keeps only the last `size` samples', () => {
    const stats = createRollingStats(3);
    for (const v of [100, 100, 100, 1, 2, 3]) stats.add(v);
    expect(stats.count()).toBe(3);
    expect(stats.mean()).toBe(2);
    expect(stats.p95()).toBe(3);
  });

  it('clears', () => {
    const stats = createRollingStats(3);
    stats.add(5);
    stats.clear();
    expect(stats.count()).toBe(0);
    stats.add(7);
    expect(stats.mean()).toBe(7);
  });
});
