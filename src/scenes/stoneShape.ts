import type { RandomSource } from '../core/seededRandom';

/** A point in CSS pixels. */
export type Point = { x: number; y: number };

/** A stone's face in CSS pixels, after the mortar gap. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How irregular a stone's outline is, in CSS pixels. */
export interface OutlineOptions {
  cornerJitterPxMin: number;
  cornerJitterPxMax: number;
  chipChance: number;
  chipSizePxMin: number;
  chipSizePxMax: number;
}

const between = (random: RandomSource, min: number, max: number): number =>
  min + random() * (max - min);

/**
 * A stone's outline, clockwise from the top-left. Each corner moves inward by a
 * small random amount, and some corners are chipped off (one point becomes two).
 * Points never leave `rect`, so the mortar gap can only grow.
 */
export function stoneOutline(rect: Rect, random: RandomSource, options: OutlineOptions): Point[] {
  const { left, top, right, bottom } = rect;
  const maxChip = Math.min(right - left, bottom - top) / 3;
  // Each corner: its position and the inward directions along its two edges.
  const corners = [
    { x: left, y: top, dx: 1, dy: 1 },
    { x: right, y: top, dx: -1, dy: 1 },
    { x: right, y: bottom, dx: -1, dy: -1 },
    { x: left, y: bottom, dx: 1, dy: -1 },
  ];
  const points: Point[] = [];
  corners.forEach((c, i) => {
    const jx = c.x + c.dx * between(random, options.cornerJitterPxMin, options.cornerJitterPxMax);
    const jy = c.y + c.dy * between(random, options.cornerJitterPxMin, options.cornerJitterPxMax);
    if (random() >= options.chipChance) {
      points.push({ x: jx, y: jy });
      return;
    }
    const chip = Math.min(maxChip, between(random, options.chipSizePxMin, options.chipSizePxMax));
    // Clockwise order: corners 0 and 2 meet the vertical edge first, 1 and 3 the horizontal one.
    const alongX = { x: jx + c.dx * chip, y: jy };
    const alongY = { x: jx, y: jy + c.dy * chip };
    points.push(...(i % 2 === 0 ? [alongY, alongX] : [alongX, alongY]));
  });
  return points;
}

/**
 * A jagged crack running from a random point on the top or left edge into the
 * stone. Every point stays inside `rect`.
 */
export function crackPath(rect: Rect, random: RandomSource): Point[] {
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const fromTop = random() < 0.5;
  let x = fromTop ? rect.left + w * between(random, 0.25, 0.75) : rect.left;
  let y = fromTop ? rect.top : rect.top + h * between(random, 0.25, 0.75);
  // Head roughly into the stone: down from the top edge, right from the left edge.
  let angle = fromTop ? Math.PI / 2 : 0;
  const points: Point[] = [{ x, y }];
  const segments = 4 + Math.floor(random() * 3);
  const step = Math.min(w, h) * 0.18;
  for (let i = 0; i < segments; i++) {
    angle += (random() - 0.5) * 1.2;
    x = Math.min(rect.right, Math.max(rect.left, x + Math.cos(angle) * step));
    y = Math.min(rect.bottom, Math.max(rect.top, y + Math.sin(angle) * step));
    points.push({ x, y });
  }
  return points;
}
