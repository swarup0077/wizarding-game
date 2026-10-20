/** A source of time in milliseconds. Injected so logic can be tested with fake time. */
export interface Clock {
  now(): number;
}

/** The real clock: `performance.now()`. */
export const systemClock: Clock = {
  now: () => performance.now(),
};

/** A clock tests can move by hand. */
export interface FakeClock extends Clock {
  /** Moves time forward by `ms`. */
  advance(ms: number): void;
  /** Jumps to an absolute time. */
  set(ms: number): void;
}

/** Creates a fake clock starting at `startMs`. */
export function createFakeClock(startMs = 0): FakeClock {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (ms) => {
      current = ms;
    },
  };
}
