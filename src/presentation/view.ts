import type { Vec2 } from '../core/types';

/** A point in CSS pixels (top-left origin). Only presentation uses these. */
export type PixelPoint = { x: number; y: number };

/**
 * Converts between normalized stage coordinates and CSS pixels.
 * The only place screen pixels appear (ARCHITECTURE.md).
 */
export interface View {
  /** Stage size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Stage width / height. Converts normalized x to square units. */
  readonly aspect: number;
  /** Device pixels per CSS pixel after the DPR cap. For offscreen caches. */
  readonly pixelRatio: number;
  /** Normalized [0,1] point → CSS pixels. */
  toPx(p: Vec2): PixelPoint;
  /** CSS pixels → normalized point. */
  fromPx(px: PixelPoint): Vec2;
  /** A length in square units (1 = stage height) → CSS pixels. */
  lengthToPx(squareUnits: number): number;
}

/** Creates a view for a stage of the given CSS size. Sizes below 1 px are treated as 1. */
export function createView(width: number, height: number, pixelRatio = 1): View {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return {
    width: w,
    height: h,
    aspect: w / h,
    pixelRatio,
    toPx: (p) => ({ x: p.x * w, y: p.y * h }),
    fromPx: (px) => ({ x: px.x / w, y: px.y / h }),
    lengthToPx: (squareUnits) => squareUnits * h,
  };
}
