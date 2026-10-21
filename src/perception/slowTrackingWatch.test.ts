import { describe, expect, it } from 'vitest';
import { createSlowTrackingWatch, type SlowTrackingChange } from './slowTrackingWatch';

const OPTIONS = { thresholdFps: 20, enterMs: 3000, recoverMs: 3000, graceMs: 1500 };

/** Feeds `fps` every 250 ms from `from` to `to` (inclusive) and collects the changes. */
function feed(
  watch: ReturnType<typeof createSlowTrackingWatch>,
  fps: number,
  from: number,
  to: number,
): { t: number; change: SlowTrackingChange }[] {
  const changes: { t: number; change: SlowTrackingChange }[] = [];
  for (let t = from; t <= to; t += 250) {
    const change = watch.update(fps, t);
    if (change) changes.push({ t, change });
  }
  return changes;
}

describe('slowTrackingWatch', () => {
  it('says nothing until restarted (it starts paused)', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    expect(feed(watch, 5, 0, 10_000)).toEqual([]);
  });

  it('turns slow after 3 s below 20 fps, once, after the start grace', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    watch.restart(0);
    // Readings during the 1.5 s grace don't count, so 3 s below runs from 1500 to 4500.
    expect(feed(watch, 12, 0, 8000)).toEqual([{ t: 4500, change: 'slow' }]);
    expect(watch.isSlow()).toBe(true);
  });

  it('a short dip does not count', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    watch.restart(0);
    expect(feed(watch, 15, 2000, 4500)).toEqual([]);
    expect(feed(watch, 28, 4750, 5000)).toEqual([]);
    expect(feed(watch, 15, 5250, 7000)).toEqual([]);
    expect(watch.isSlow()).toBe(false);
  });

  it('exactly 20 fps is not slow', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    watch.restart(0);
    expect(feed(watch, 20, 0, 10_000)).toEqual([]);
  });

  it('recovers only after 3 s at or above the threshold (hysteresis)', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    watch.restart(0);
    feed(watch, 10, 1500, 4500);
    expect(watch.isSlow()).toBe(true);
    // Flapping around the threshold keeps it slow.
    expect(feed(watch, 24, 4750, 5500)).toEqual([]);
    expect(feed(watch, 18, 5750, 6000)).toEqual([]);
    expect(feed(watch, 26, 6250, 9500)).toEqual([{ t: 9250, change: 'recovered' }]);
  });

  it('ignores readings while paused, and grants a new grace on restart', () => {
    const watch = createSlowTrackingWatch(OPTIONS);
    watch.restart(0);
    feed(watch, 10, 1500, 3000);
    watch.pause(); // e.g. the tab was hidden: fps falls to zero, but no tip
    expect(feed(watch, 0, 3250, 20_000)).toEqual([]);
    watch.restart(20_000);
    // The earlier 1.5 s below doesn't carry over: a full 3 s after the grace is needed.
    expect(feed(watch, 10, 20_000, 25_000)).toEqual([{ t: 24_500, change: 'slow' }]);
  });
});
