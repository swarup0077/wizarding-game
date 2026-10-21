import { describe, expect, it } from 'vitest';
import { TRACKING } from '../config/tuning';
import { createTrackerMetrics } from './trackerMetrics';

describe('trackerMetrics', () => {
  it('latency is capture → result; skew is how far the picture ran ahead', () => {
    const m = createTrackerMetrics();
    // Frame A captured at 1000 is sent; frame B (1033) is presented before A's result at 1045.
    m.videoFrame(1001, 1000);
    m.videoFrame(1034, 1033);
    m.result(1045, 1000, 25);
    const r = m.read(1045);
    expect(r.latencyMs).toBeCloseTo(45);
    expect(r.skewMs).toBeCloseTo(33);
  });

  it('a result for the newest presented frame has no skew (the main-thread case)', () => {
    const m = createTrackerMetrics();
    m.videoFrame(2001, 2000);
    m.result(2026, 2000, 25);
    expect(m.read(2026).skewMs).toBe(0);
  });

  it('keeps the first detection apart and leaves the warm-up ones out of the mean', () => {
    const m = createTrackerMetrics();
    const times = [400, 90, 60, 20, 22];
    times.forEach((ms, i) => m.result(1000 + i * 33, 1000 + i * 33 - 30, ms));
    const r = m.read(1200);
    expect(r.firstDetectMs).toBe(400);
    const counted = times.slice(TRACKING.warmupDetections);
    expect(r.detectMeanMs).toBeCloseTo(counted.reduce((a, b) => a + b, 0) / counted.length);
  });

  it('reset starts the detection numbers over', () => {
    const m = createTrackerMetrics();
    m.result(1000, 960, 30);
    m.reset();
    const r = m.read(1000);
    expect(r.firstDetectMs).toBeNull();
    expect(r.latencyMs).toBe(0);
    m.result(1100, 1080, 12);
    expect(m.read(1100).firstDetectMs).toBe(12);
  });

  it('counts tracking and video rates separately', () => {
    const m = createTrackerMetrics();
    for (let i = 0; i <= 30; i++) {
      const t = i * (1000 / 30);
      m.videoFrame(t, t);
      if (i % 2 === 0) m.result(t + 20, t, 20); // every other frame analysed
    }
    const r = m.read(1000);
    expect(r.videoFps).toBeGreaterThan(28);
    expect(r.trackingFps).toBeGreaterThan(13);
    expect(r.trackingFps).toBeLessThan(17);
  });
});
