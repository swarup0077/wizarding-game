// Decides when tracking is too slow to cast well (FR-2: below 20 fps for 3 s → a tip). Pure.
//
// Hysteresis: "slow" starts after fps stays below the threshold for `enterMs`, and ends only
// after it stays at or above it for `recoverMs`, so a reading hovering at the threshold
// doesn't flap. Readings are ignored while paused (camera off, tab hidden: no frames arrive,
// so fps falls to zero for reasons a tip can't fix) and for a grace period after each
// (re)start, while the fps meter fills its window.

/** The watch's thresholds (TRACKING in config/tuning). */
export interface SlowTrackingOptions {
  thresholdFps: number;
  enterMs: number;
  recoverMs: number;
  graceMs: number;
}

/** A change of state, or nothing. */
export type SlowTrackingChange = 'slow' | 'recovered' | null;

/** The watch. */
export interface SlowTrackingWatch {
  /** Called regularly with the current tracking fps. Returns a change when there is one. */
  update(fps: number, nowMs: number): SlowTrackingChange;
  /** Tracking started or resumed: readings count again after the grace period. */
  restart(nowMs: number): void;
  /** Tracking paused: readings are ignored. The current state is kept. */
  pause(): void;
  isSlow(): boolean;
}

/** Creates a watch. It starts paused; call `restart()` when tracking begins. */
export function createSlowTrackingWatch(options: SlowTrackingOptions): SlowTrackingWatch {
  const { thresholdFps, enterMs, recoverMs, graceMs } = options;
  let paused = true;
  let slow = false;
  let graceUntil = 0;
  let belowSince: number | null = null;
  let aboveSince: number | null = null;

  return {
    update(fps, now) {
      if (paused || now < graceUntil) return null;
      const below = fps < thresholdFps;
      if (!slow) {
        aboveSince = null;
        if (!below) {
          belowSince = null;
          return null;
        }
        belowSince ??= now;
        if (now - belowSince < enterMs) return null;
        slow = true;
        belowSince = null;
        return 'slow';
      }
      belowSince = null;
      if (below) {
        aboveSince = null;
        return null;
      }
      aboveSince ??= now;
      if (now - aboveSince < recoverMs) return null;
      slow = false;
      aboveSince = null;
      return 'recovered';
    },
    restart(now) {
      paused = false;
      graceUntil = now + graceMs;
      belowSince = null;
      aboveSince = null;
    },
    pause() {
      paused = true;
      belowSince = null;
      aboveSince = null;
    },
    isSlow: () => slow,
  };
}
