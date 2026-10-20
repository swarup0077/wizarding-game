/** Measures a rate (render frames, tracking frames) from event timestamps. */
export interface FpsMeter {
  /** Records one frame at time `t` (ms). */
  tick(t: number): void;
  /** Frames per second over the sliding window ending at `now` (ms). 0 until there are 2 frames. */
  read(now: number): number;
}

/** Creates a meter averaging over the last `windowMs` milliseconds. */
export function createFpsMeter(windowMs: number): FpsMeter {
  const ticks: number[] = [];

  const prune = (now: number): void => {
    const cutoff = now - windowMs;
    while (ticks.length > 0 && (ticks[0] ?? Infinity) <= cutoff) ticks.shift();
  };

  return {
    tick(t) {
      ticks.push(t);
      prune(t);
    },
    read(now) {
      prune(now);
      const oldest = ticks[0];
      if (ticks.length < 2 || oldest === undefined || now <= oldest) return 0;
      // Intervals since the oldest frame in the window, divided by the time they took.
      // Measuring up to `now` (not the last frame) makes a stall lower the reading.
      return ((ticks.length - 1) * 1000) / (now - oldest);
    },
  };
}
