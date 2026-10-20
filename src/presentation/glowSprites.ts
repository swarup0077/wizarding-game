import { quantizeRgb, type Rgb, rgba } from './trailColors';

/** Sprite resolution in device pixels. Drawn scaled; soft glows don't need more. */
const GLOW_SIZE = 128;
const SPARKLE_SIZE = 64;

/**
 * Pre-rendered glow and sparkle images, one per (rounded) colour. All glow in the
 * game is built from these stamped with additive blending: no shadowBlur, no
 * ctx.filter, which are very slow on integrated graphics.
 */
export interface SpriteCache {
  /** A soft radial glow, brightest in the centre, fading smoothly to nothing. */
  glow(colour: Rgb): HTMLCanvasElement;
  /** A tiny bright point with a faint four-pointed glint. */
  sparkle(colour: Rgb): HTMLCanvasElement;
  /** Builds sprites ahead of time, so none is created mid-stroke (a visible hitch). */
  warm(glowColours: Iterable<Rgb>, sparkleColours: Iterable<Rgb>): void;
  /** Number of cached sprites. */
  size(): number;
}

/** Creates an empty cache. Sprites are built on first use. */
export function createSpriteCache(): SpriteCache {
  const glows = new Map<string, HTMLCanvasElement>();
  const sparkles = new Map<string, HTMLCanvasElement>();

  const cached = (
    store: Map<string, HTMLCanvasElement>,
    colour: Rgb,
    build: (c: Rgb) => HTMLCanvasElement,
  ): HTMLCanvasElement => {
    const c = quantizeRgb(colour);
    const key = c.join(',');
    let sprite = store.get(key);
    if (!sprite) {
      sprite = build(c);
      store.set(key, sprite);
    }
    return sprite;
  };

  return {
    glow: (colour) => cached(glows, colour, buildGlow),
    sparkle: (colour) => cached(sparkles, colour, buildSparkle),
    warm(glowColours, sparkleColours) {
      for (const c of glowColours) cached(glows, c, buildGlow);
      for (const c of sparkleColours) cached(sparkles, c, buildSparkle);
    },
    size: () => glows.size + sparkles.size,
  };
}

function blankSprite(size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext('2d')];
}

function buildGlow(c: Rgb): HTMLCanvasElement {
  const [canvas, g] = blankSprite(GLOW_SIZE);
  if (!g) return canvas;
  const r = GLOW_SIZE / 2;
  // Roughly Gaussian falloff: a bright centre and a long, faint skirt.
  const gradient = g.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, rgba(c, 1));
  gradient.addColorStop(0.15, rgba(c, 0.62));
  gradient.addColorStop(0.4, rgba(c, 0.2));
  gradient.addColorStop(0.7, rgba(c, 0.05));
  gradient.addColorStop(1, rgba(c, 0));
  g.fillStyle = gradient;
  g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return canvas;
}

function buildSparkle(c: Rgb): HTMLCanvasElement {
  const [canvas, g] = blankSprite(SPARKLE_SIZE);
  if (!g) return canvas;
  const r = SPARKLE_SIZE / 2;
  const core = g.createRadialGradient(r, r, 0, r, r, r * 0.55);
  core.addColorStop(0, rgba([255, 255, 250], 1));
  core.addColorStop(0.25, rgba(c, 0.85));
  core.addColorStop(1, rgba(c, 0));
  g.fillStyle = core;
  g.fillRect(0, 0, SPARKLE_SIZE, SPARKLE_SIZE);

  // A faint glint: horizontal and vertical rays fading toward the sprite edge.
  g.globalCompositeOperation = 'lighter';
  for (const [x0, y0, x1, y1] of [
    [0, r, SPARKLE_SIZE, r],
    [r, 0, r, SPARKLE_SIZE],
  ] as const) {
    const ray = g.createLinearGradient(x0, y0, x1, y1);
    ray.addColorStop(0, rgba(c, 0));
    ray.addColorStop(0.5, rgba(c, 0.55));
    ray.addColorStop(1, rgba(c, 0));
    g.strokeStyle = ray;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  return canvas;
}
