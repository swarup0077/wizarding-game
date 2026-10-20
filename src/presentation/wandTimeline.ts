import { INPUT } from '../config/tuning';
import type { Vec2 } from '../core/types';
import { catmullRom, reflectEnd } from './catmullRom';

/** A wand sample in normalized coordinates with its time (ms). */
export interface TimedPoint {
  x: number;
  y: number;
  t: number;
}

/** Recent wand samples, interpolated in time along a centripetal Catmull-Rom spline. */
export interface WandTimeline {
  push(sample: TimedPoint): void;
  /** Samples from `from` to `to` (inclusive), oldest first. */
  between(from: number, to: number): TimedPoint[];
  /** The newest sample, if any. */
  latest(): TimedPoint | undefined;
  /** Where the wand was at time `t`, in square units (x × aspect). Clamped to the known range. */
  positionAt(t: number, aspect: number): Vec2 | undefined;
  /** Smoothed input rate in samples per second (0 until measured). */
  rateHz(): number;
  /** How far in the past to draw so there is always a next sample to interpolate toward. */
  renderDelayMs(): number;
  /** Drops samples older than `t`, always keeping the last few. */
  pruneBefore(t: number): void;
}

const KEEP_AT_LEAST = 4;

/** Converts a normalized sample to square units. */
export const toSquare = (s: TimedPoint, aspect: number): Vec2 => ({ x: s.x * aspect, y: s.y });

/** Creates an empty timeline. */
export function createWandTimeline(): WandTimeline {
  const samples: TimedPoint[] = [];
  let intervalMs = 0;

  const at = (i: number): TimedPoint | undefined => samples[i];

  /** Index of the last sample at or before `t` (−1 if none). */
  const indexAtOrBefore = (t: number): number => {
    let lo = 0;
    let hi = samples.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((at(mid)?.t ?? Infinity) <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };

  return {
    push(sample) {
      const last = samples[samples.length - 1];
      if (last && sample.t < last.t) return; // out of order: ignore
      if (last) {
        const gap = sample.t - last.t;
        if (gap >= INPUT.rateMinGapMs && gap < INPUT.rateGapMs) {
          intervalMs =
            intervalMs === 0 ? gap : intervalMs + (gap - intervalMs) * INPUT.rateSmoothing;
        }
      }
      samples.push(sample);
    },

    between(from, to) {
      return samples.filter((s) => s.t >= from && s.t <= to);
    },

    latest: () => samples[samples.length - 1],

    positionAt(t, aspect) {
      const first = at(0);
      const last = at(samples.length - 1);
      if (!first || !last) return undefined;
      if (t <= first.t) return toSquare(first, aspect);
      if (t >= last.t) return toSquare(last, aspect);
      const i = indexAtOrBefore(t);
      const a = at(i);
      const b = at(i + 1);
      if (!a || !b) return toSquare(last, aspect);
      const p1 = toSquare(a, aspect);
      const p2 = toSquare(b, aspect);
      const before = at(i - 1);
      const after = at(i + 2);
      const p0 = before ? toSquare(before, aspect) : reflectEnd(p1, p2);
      const p3 = after ? toSquare(after, aspect) : reflectEnd(p2, p1);
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return catmullRom(p0, p1, p2, p3, u);
    },

    rateHz: () => (intervalMs > 0 ? 1000 / intervalMs : 0),

    renderDelayMs() {
      const delay = intervalMs * INPUT.renderDelayIntervals;
      return Math.min(INPUT.renderDelayMaxMs, Math.max(INPUT.renderDelayMinMs, delay));
    },

    pruneBefore(t) {
      while (samples.length > KEEP_AT_LEAST && (samples[0]?.t ?? Infinity) < t) samples.shift();
    },
  };
}
