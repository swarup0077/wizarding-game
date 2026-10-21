import { describe, expect, it } from 'vitest';
import { createDetectScheduler } from './detectScheduler';

describe('detectScheduler', () => {
  it('analyses each new frame once', () => {
    const s = createDetectScheduler();
    expect(s.begin(1, 100)).toBe(100);
    s.finish();
    expect(s.begin(1, 110)).toBeNull();
    expect(s.begin(2, 133)).toBe(133);
  });

  it('never starts a detection while one is running', () => {
    const s = createDetectScheduler();
    expect(s.begin(1, 100)).not.toBeNull();
    expect(s.busy()).toBe(true);
    expect(s.begin(2, 133)).toBeNull();
    s.finish();
    expect(s.busy()).toBe(false);
    // The frame skipped while busy is gone; the next new frame is analysed.
    expect(s.begin(3, 166)).toBe(166);
  });

  it('timestamps strictly increase, even within one millisecond or a clock step back', () => {
    const s = createDetectScheduler();
    const stamps: number[] = [];
    for (const [frame, now] of [
      [1, 100.2],
      [2, 100.4],
      [3, 100.1],
      [4, 99],
      [5, 140],
    ] as const) {
      const ts = s.begin(frame, now);
      s.finish();
      if (ts !== null) stamps.push(ts);
    }
    expect(stamps).toEqual([100, 101, 102, 103, 140]);
    expect(stamps.every(Number.isInteger)).toBe(true);
  });

  it('after a camera restart, frame ids start over but timestamps keep increasing', () => {
    const s = createDetectScheduler();
    s.begin(7, 500);
    s.finish();
    s.resetFrames();
    expect(s.begin(7, 500)).toBe(501);
  });
});
