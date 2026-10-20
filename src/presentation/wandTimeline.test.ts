import { describe, expect, it } from 'vitest';
import { createWandTimeline } from './wandTimeline';

const feed = (hz: number, ms: number) => {
  const timeline = createWandTimeline();
  for (let t = 0; t <= ms; t += 1000 / hz) timeline.push({ x: t / 1000, y: 0.5, t });
  return timeline;
};

describe('wandTimeline', () => {
  it('measures the input rate', () => {
    expect(feed(30, 1000).rateHz()).toBeCloseTo(30, 0);
    expect(feed(125, 1000).rateHz()).toBeCloseTo(125, 0);
  });

  it('ignores near-simultaneous samples (final position + release) when measuring the rate', () => {
    const timeline = feed(30, 1000);
    const last = timeline.latest()?.t ?? 0;
    timeline.push({ x: 1, y: 0.5, t: last + 1 });
    expect(timeline.rateHz()).toBeCloseTo(30, 0);
  });

  it('draws about one input interval in the past, within limits', () => {
    expect(feed(30, 1000).renderDelayMs()).toBeCloseTo((1000 / 30) * 1.25, 0);
    expect(feed(1000, 500).renderDelayMs()).toBe(4);
    expect(createWandTimeline().renderDelayMs()).toBe(4);
  });

  it('interpolates between samples (straight motion stays straight and proportional)', () => {
    const q = feed(30, 1000).positionAt(50, 1);
    expect(q?.x).toBeCloseTo(0.05, 3);
    expect(q?.y).toBeCloseTo(0.5, 6);
  });

  it('returns positions in square units (x × aspect)', () => {
    const timeline = createWandTimeline();
    timeline.push({ x: 0.5, y: 0.5, t: 0 });
    expect(timeline.positionAt(0, 16 / 9)).toEqual({ x: 0.5 * (16 / 9), y: 0.5 });
  });

  it('clamps to the first and last samples', () => {
    const timeline = feed(30, 1000);
    expect(timeline.positionAt(-100, 1)?.x).toBeCloseTo(0);
    expect(timeline.positionAt(5000, 1)?.x).toBeCloseTo(timeline.latest()?.x ?? NaN);
    expect(createWandTimeline().positionAt(0, 1)).toBeUndefined();
  });

  it('ignores out-of-order samples and prunes old ones but keeps a few', () => {
    const timeline = feed(30, 1000);
    timeline.push({ x: 9, y: 9, t: 10 });
    expect(timeline.latest()?.x).not.toBe(9);
    timeline.pruneBefore(1e9);
    expect(timeline.between(-Infinity, Infinity)).toHaveLength(4);
  });
});
