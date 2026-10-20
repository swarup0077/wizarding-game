import type { Vec2 } from '../../core/types';

/** Where along the stroke (0–1 of its length) the direction arrow sits. */
const ARROW_AT = 0.18;

/** A spell shape laid out for drawing: an SVG path, its start point and a direction arrow. */
export interface ShapeGeometry {
  d: string;
  start: Vec2;
  arrow: Vec2 & { angleDeg: number };
}

/**
 * Lays out `points` (unit box, y down) in a `size` × `size` box with `pad` margin.
 * The arrow sits early on the stroke and points along it, so it shows which way to
 * go from the start dot, even on a closed shape like the circle.
 */
export function shapeGeometry(points: Vec2[], size: number, pad: number): ShapeGeometry {
  const span = size - pad * 2;
  const at = (p: Vec2): Vec2 => ({ x: pad + p.x * span, y: pad + p.y * span });
  const placed = points.map(at);
  const first = placed[0] ?? { x: pad, y: pad };
  const d = placed
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const lengths = [0];
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i - 1] ?? first;
    const b = placed[i] ?? a;
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const target = (lengths[lengths.length - 1] ?? 0) * ARROW_AT;
  let i = 1;
  while (i < placed.length - 1 && (lengths[i] ?? 0) < target) i++;
  const a = placed[i - 1] ?? first;
  const b = placed[i] ?? a;
  const angleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return { d, start: first, arrow: { x: b.x, y: b.y, angleDeg } };
}
