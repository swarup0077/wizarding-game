import { WAND_DOT } from '../config/tuning';
import type { Vec2 } from '../core/types';
import type { SpriteCache } from './glowSprites';
import { drawGlow } from './trailDraw';
import type { Rgb } from './trailColors';

const DOT_GLOW: Rgb = [255, 206, 120];
const DOT_CORE: Rgb = [255, 248, 230];

/** The dot's colours, so the sprite cache can build them up front. */
export const DOT_COLOURS: readonly Rgb[] = [DOT_GLOW, DOT_CORE];

/** The idle dot's gentle pulse at time `tMs`: 1 ± pulseDepth, one cycle per 1/pulseHz s. */
export function dotPulse(tMs: number): number {
  return 1 + WAND_DOT.pulseDepth * Math.sin((tMs / 1000) * WAND_DOT.pulseHz * Math.PI * 2);
}

/** Draws the idle wand dot (FR-18): a small bright core in a soft, slowly pulsing glow. */
export function drawWandDot(
  g: CanvasRenderingContext2D,
  at: Vec2,
  tMs: number,
  unit: number,
  sprites: SpriteCache,
  visibility: number,
): void {
  const pulse = dotPulse(tMs);
  drawGlow(
    g,
    sprites.glow(DOT_GLOW),
    at.x,
    at.y,
    WAND_DOT.glowRadius * pulse,
    WAND_DOT.glowAlpha * pulse * visibility,
    unit,
  );
  drawGlow(g, sprites.glow(DOT_CORE), at.x, at.y, WAND_DOT.coreRadius * 2, 0.9 * visibility, unit);
}
