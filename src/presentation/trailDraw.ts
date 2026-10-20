import { TRAIL } from '../config/tuning';
import type { SpriteCache } from './glowSprites';
import { type ReleaseOutcome, rgba, spriteColor, trailColor } from './trailColors';
import { fade, taper, type TrailPoint } from './trailModel';

/** How one stroke should look this frame. */
export interface TrailStyle {
  energy: number;
  outcome: ReleaseOutcome;
  /** 0–1 blend toward the outcome colour. */
  release: number;
  /** Brightness multiplier (gold flash > 1, grey < 1). */
  boost: number;
}

const lerp = (a: number, b: number, m: number): number => a + (b - a) * m;

/**
 * Draws one stroke (points head first, square units) with additive blending:
 * a wide soft glow, a tighter inner glow, then a thin bright core.
 * `unit` is CSS pixels per square unit (the stage height).
 */
export function drawTrail(
  g: CanvasRenderingContext2D,
  points: TrailPoint[],
  unit: number,
  style: TrailStyle,
  sprites: SpriteCache,
): void {
  if (points.length < 2) return;
  const glowGain = 1 + style.energy * TRAIL.energyGlowGain;
  stampGlow(g, points, unit, style, sprites, {
    head: TRAIL.glowRadiusHead * glowGain,
    tail: TRAIL.glowRadiusTail,
    alpha: TRAIL.glowAlpha,
  });
  stampGlow(g, points, unit, style, sprites, {
    head: TRAIL.midRadiusHead * glowGain,
    tail: TRAIL.midRadiusTail,
    alpha: TRAIL.midAlpha,
  });
  drawCore(g, points, unit, style);
}

type GlowLayer = { head: number; tail: number; alpha: number };

/** Stamps glow sprites along the trail, spaced in proportion to their size. */
function stampGlow(
  g: CanvasRenderingContext2D,
  points: TrailPoint[],
  unit: number,
  style: TrailStyle,
  sprites: SpriteCache,
  layer: GlowLayer,
): void {
  let travelled = Infinity; // stamp the head first
  let previous: TrailPoint | undefined;
  for (const p of points) {
    if (previous) travelled += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;
    const k = p.age / TRAIL.fadeMs;
    const radius = lerp(layer.tail, layer.head, taper(k));
    if (travelled < radius * TRAIL.stampSpacing) continue;
    travelled = 0;
    const alpha = layer.alpha * fade(k) * style.boost;
    if (alpha <= 0.002) continue;
    const sprite = sprites.glow(spriteColor(k, style.energy, style.outcome, style.release));
    const size = radius * 2 * unit;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(sprite, p.x * unit - size / 2, p.y * unit - size / 2, size, size);
  }
  g.globalAlpha = 1;
}

/**
 * The core is stroked in age bands. Within a band the path is continuous (no bright
 * beads where additive line caps overlap); each band has its own width and alpha,
 * which gives a smooth taper and fade.
 */
function drawCore(
  g: CanvasRenderingContext2D,
  points: TrailPoint[],
  unit: number,
  style: TrailStyle,
): void {
  const bands = TRAIL.coreBands;
  const coreGain = 1 + style.energy * TRAIL.energyCoreGain;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  let index = 0;
  for (let b = 0; b < bands && index < points.length - 1; b++) {
    const kEnd = (b + 1) / bands;
    const start = index;
    while (
      index < points.length - 1 &&
      (points[index + 1]?.age ?? Infinity) / TRAIL.fadeMs <= kEnd
    ) {
      index++;
    }
    if (index === start) index++; // always advance, even across a long gap
    const kMid = (b + 0.5) / bands;
    const alpha = Math.min(1, fade(kMid) * style.boost);
    if (alpha <= 0.002) continue;
    g.beginPath();
    for (let i = start; i <= index; i++) {
      const p = points[i];
      if (!p) continue;
      if (i === start) g.moveTo(p.x * unit, p.y * unit);
      else g.lineTo(p.x * unit, p.y * unit);
    }
    g.lineWidth = Math.max(
      0.5,
      lerp(TRAIL.coreWidthTail, TRAIL.coreWidthHead * coreGain, taper(kMid)) * unit,
    );
    g.strokeStyle = rgba(trailColor(kMid * 0.8, style.energy, style.outcome, style.release), alpha);
    g.stroke();
  }
}

/** Draws one glow sprite centred on a point (square units) with the given radius. */
export function drawGlow(
  g: CanvasRenderingContext2D,
  sprite: CanvasImageSource,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  unit: number,
): void {
  if (alpha <= 0.002) return;
  const size = radius * 2 * unit;
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(sprite, x * unit - size / 2, y * unit - size / 2, size, size);
  g.globalAlpha = 1;
}
