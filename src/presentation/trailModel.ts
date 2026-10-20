import { TRAIL } from '../config/tuning';
import type { Vec2 } from '../core/types';
import { catmullRom, reflectEnd } from './catmullRom';
import { type TimedPoint, toSquare } from './wandTimeline';

/** A point on the drawn trail, in square units, with its age in ms. */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

/**
 * The visible part of one stroke as dense spline points, head first.
 * `samples` are the stroke's samples (oldest first); `renderNow` is the time being
 * drawn (now − render delay). Points older than the fade time are left out, and the
 * head is interpolated exactly at `renderNow` while the stroke is still growing.
 */
export function buildTrail(
  samples: TimedPoint[],
  renderNow: number,
  aspect: number,
  step: number = TRAIL.subdivisionStep,
): TrailPoint[] {
  const oldest = renderNow - TRAIL.fadeMs;
  const sq = samples.map((s) => toSquare(s, aspect));
  const points: TrailPoint[] = [];

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const p1 = sq[i];
    const p2 = sq[i + 1];
    if (!a || !b || !p1 || !p2) continue;
    if (b.t < oldest || a.t > renderNow) continue;

    const p0 = sq[i - 1] ?? reflectEnd(p1, p2);
    const p3 = sq[i + 2] ?? reflectEnd(p2, p1);
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const t = a.t + (b.t - a.t) * u;
      if (t < oldest) continue;
      if (t > renderNow) break;
      const p = catmullRom(p0, p1, p2, p3, u);
      points.push({ x: p.x, y: p.y, age: renderNow - t });
    }
  }

  const head = headPoint(samples, sq, renderNow, oldest);
  if (head) points.push(head);
  return points.reverse();
}

/** The newest drawable point: the last sample, or the interpolated position at `renderNow`. */
function headPoint(
  samples: TimedPoint[],
  sq: Vec2[],
  renderNow: number,
  oldest: number,
): TrailPoint | undefined {
  const lastIndex = samples.length - 1;
  const last = samples[lastIndex];
  const lastSq = sq[lastIndex];
  if (!last || !lastSq) return undefined;
  if (last.t <= renderNow) {
    return last.t >= oldest ? { x: lastSq.x, y: lastSq.y, age: renderNow - last.t } : undefined;
  }
  // The newest sample is still in the future: interpolate inside the segment containing now.
  for (let i = lastIndex - 1; i >= 0; i--) {
    const a = samples[i];
    const b = samples[i + 1];
    const p1 = sq[i];
    const p2 = sq[i + 1];
    if (!a || !b || !p1 || !p2 || a.t > renderNow) continue;
    const u = b.t > a.t ? (renderNow - a.t) / (b.t - a.t) : 1;
    const p = catmullRom(
      sq[i - 1] ?? reflectEnd(p1, p2),
      p1,
      p2,
      sq[i + 2] ?? reflectEnd(p2, p1),
      u,
    );
    return { x: p.x, y: p.y, age: 0 };
  }
  return undefined;
}

/** Energy (0 calm … 1 energetic) for a head speed in square units per second. */
export function energyForSpeed(speed: number): number {
  const k = (speed - TRAIL.calmSpeed) / (TRAIL.energeticSpeed - TRAIL.calmSpeed);
  const clamped = Math.min(1, Math.max(0, k));
  return clamped * clamped * (3 - 2 * clamped); // smoothstep: gentle at both ends
}

/** Moves `current` toward `target` with a time constant, independent of frame rate. */
export function smoothToward(
  current: number,
  target: number,
  dtMs: number,
  timeMs: number,
): number {
  if (timeMs <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dtMs / timeMs));
}

/** Trail width falloff from head (k = 0) to tail (k = 1): full at the head, thin at the tail. */
export function taper(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return (1 - c) ** 1.4;
}

/** Trail brightness from head (k = 0) to tail (k = 1): holds near the head, then fades out. */
export function fade(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return (1 - c * c) * (1 - c);
}
