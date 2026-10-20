import type { WandSample } from './wandSource';

/** Passes samples through at a fixed maximum rate, keeping the latest position. */
export interface RateSampler {
  /** Offers a sample. Returns it if a slot is due, otherwise holds it as the latest. */
  offer(sample: WandSample): WandSample | null;
  /** Returns the held sample if it hasn't been passed on yet (call on release). */
  flush(): WandSample | null;
  /** Restarts the rate grid at time `t` (call when a stroke starts). */
  reset(t: number): void;
}

/**
 * Creates a sampler limited to `hz`. It behaves like a camera: each slot passes on
 * wherever the input happens to be at that moment; positions between slots are lost.
 */
export function createRateSampler(hz: number): RateSampler {
  const period = 1000 / hz;
  let nextDue = -Infinity;
  let held: WandSample | null = null;

  return {
    offer(sample) {
      if (sample.t < nextDue) {
        held = sample;
        return null;
      }
      nextDue = nextDue === -Infinity ? sample.t + period : nextDue + period;
      // After a long pause, restart the grid instead of bursting to catch up.
      if (nextDue <= sample.t) nextDue = sample.t + period;
      held = null;
      return sample;
    },
    flush() {
      const pending = held;
      held = null;
      return pending;
    },
    reset(t) {
      nextDue = t + period;
      held = null;
    },
  };
}
