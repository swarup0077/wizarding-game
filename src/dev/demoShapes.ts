// The three Phase 0 spell shapes from FR-10, in a unit box (y grows downward), for the
// stroke demo. T7's defaultTemplates.ts will replace these so the shapes live in one place.
import type { Vec2 } from '../core/types';

/** A demo shape as a dense polyline with cumulative arc lengths for even-speed playback. */
export interface DemoShape {
  name: 'circle' | 'zigzag' | 'swish';
  points: Vec2[];
  /** Arc length from the start to each point, normalized so the last is 1. */
  lengths: number[];
}

const DENSITY = 240;

function withLengths(name: DemoShape['name'], points: Vec2[]): DemoShape {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    lengths.push((lengths[i - 1] ?? 0) + (a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0));
  }
  const total = lengths[lengths.length - 1] || 1;
  return { name, points, lengths: lengths.map((l) => l / total) };
}

const range = (n: number): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

/** Lumos: clockwise circle from 12 o'clock, heading right. */
const circle = range(DENSITY).map((u) => {
  const theta = -Math.PI / 2 + u * Math.PI * 2;
  return { x: 0.5 + 0.5 * Math.cos(theta), y: 0.5 + 0.5 * Math.sin(theta) };
});

/** Wingardium Leviosa: quadratic Bézier swish, then a straight flick up and right. */
const swish = [
  ...range(DENSITY * 0.7).map((u) => ({
    x: (1 - u) ** 2 * 0 + 2 * (1 - u) * u * 0.35 + u * u * 0.7,
    y: (1 - u) ** 2 * 0.25 + 2 * (1 - u) * u * 1.15 + u * u * 0.7,
  })),
  ...range(DENSITY * 0.3)
    .slice(1)
    .map((u) => ({ x: 0.7 + 0.3 * u, y: 0.7 - 0.65 * u })),
];

/** Incendio: a rising zigzag, like a flame. */
const corners: Vec2[] = [
  { x: 0.5, y: 1 },
  { x: 0.15, y: 0.7 },
  { x: 0.85, y: 0.5 },
  { x: 0.2, y: 0.3 },
  { x: 0.6, y: 0 },
];
const zigzag = corners.slice(1).flatMap((b, i) => {
  const a = corners[i] ?? b;
  return range(DENSITY / 4)
    .slice(i === 0 ? 0 : 1)
    .map((u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }));
});

/** Every demo shape. */
export const demoShapes: DemoShape[] = [
  withLengths('circle', circle),
  withLengths('zigzag', zigzag),
  withLengths('swish', swish),
];

/** The point at arc-length fraction `s` (0–1) along a shape. */
export function pointAlong(shape: DemoShape, s: number): Vec2 {
  const { points, lengths } = shape;
  const target = Math.min(1, Math.max(0, s));
  let i = 1;
  while (i < lengths.length - 1 && (lengths[i] ?? 1) < target) i++;
  const a = points[i - 1] ?? { x: 0, y: 0 };
  const b = points[i] ?? a;
  const la = lengths[i - 1] ?? 0;
  const lb = lengths[i] ?? 1;
  const m = lb > la ? (target - la) / (lb - la) : 0;
  return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m };
}
