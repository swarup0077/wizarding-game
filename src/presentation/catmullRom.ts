import type { Vec2 } from '../core/types';

/** Knot spacing exponent: 0.5 = centripetal, which never loops or overshoots. */
const ALPHA = 0.5;
/** Smallest knot step, so repeated points don't divide by zero. */
const MIN_KNOT = 1e-6;

const knot = (a: Vec2, b: Vec2): number =>
  Math.max(MIN_KNOT, Math.hypot(b.x - a.x, b.y - a.y) ** ALPHA);

const mix = (a: Vec2, b: Vec2, ta: number, tb: number, t: number): Vec2 => {
  const span = tb - ta;
  const wa = (tb - t) / span;
  const wb = (t - ta) / span;
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb };
};

/**
 * A point on the centripetal Catmull-Rom curve between `p1` (u = 0) and `p2` (u = 1),
 * shaped by the neighbours `p0` and `p3`. Points must share isotropic units
 * (square units), or the curve bends differently on wide screens.
 */
export function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, u: number): Vec2 {
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const a1 = mix(p0, p1, t0, t1, t);
  const a2 = mix(p1, p2, t1, t2, t);
  const a3 = mix(p2, p3, t2, t3, t);
  const b1 = mix(a1, a2, t0, t2, t);
  const b2 = mix(a2, a3, t1, t3, t);
  return mix(b1, b2, t1, t2, t);
}

/** A stand-in neighbour beyond an end point, continuing the end segment's direction. */
export function reflectEnd(end: Vec2, inner: Vec2): Vec2 {
  return { x: 2 * end.x - inner.x, y: 2 * end.y - inner.y };
}
