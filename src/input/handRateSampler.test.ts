import { describe, expect, it } from 'vitest';
import { createRateSampler } from './handRateSampler';

const at = (t: number, x = t) => ({ p: { x, y: 0 }, t });

describe('handRateSampler', () => {
  it('passes about 30 samples a second, each on the first input after its slot', () => {
    const sampler = createRateSampler(30);
    const passed = [];
    for (let t = 0; t <= 1000; t += 1000 / 120) {
      const out = sampler.offer(at(t));
      if (out) passed.push(out);
    }
    expect(passed.length).toBeGreaterThanOrEqual(29);
    expect(passed.length).toBeLessThanOrEqual(31);
    // A slot passes the first input at or after it, so gaps jitter by up to one input
    // interval (8.3 ms at 120 Hz) around 1/30 s, like a real camera's frame timing.
    for (let i = 1; i < passed.length; i++) {
      const gap = (passed[i]?.t ?? 0) - (passed[i - 1]?.t ?? 0);
      expect(gap).toBeGreaterThan(1000 / 30 - 1000 / 120);
      expect(gap).toBeLessThan(1000 / 30 + 1000 / 120);
    }
  });

  it('passes the latest position when a slot comes due, not an older one', () => {
    const sampler = createRateSampler(30);
    sampler.reset(0);
    expect(sampler.offer(at(10, 1))).toBeNull();
    expect(sampler.offer(at(20, 2))).toBeNull();
    expect(sampler.offer(at(34, 3))).toEqual(at(34, 3));
  });

  it('flushes the held sample on release, once', () => {
    const sampler = createRateSampler(30);
    sampler.reset(0);
    sampler.offer(at(10, 7));
    expect(sampler.flush()).toEqual(at(10, 7));
    expect(sampler.flush()).toBeNull();
  });

  it('restarts the grid after a long pause instead of bursting', () => {
    const sampler = createRateSampler(30);
    expect(sampler.offer(at(0))).not.toBeNull();
    expect(sampler.offer(at(5000))).not.toBeNull();
    expect(sampler.offer(at(5010))).toBeNull();
  });
});
