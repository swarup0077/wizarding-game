import type { Vec2 } from '../core/types';

/** Anything that drives the wand (mouse now, hand tracking later). Emits `wand:*` on the bus. */
export interface WandSource {
  start(): void;
  stop(): void;
}

/** One wand position from an input device: normalized point and time (ms). */
export interface WandSample {
  p: Vec2;
  t: number;
}
