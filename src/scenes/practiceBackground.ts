import { STAGE_LOOK } from '../config/tuning';
import { createSeededRandom, type RandomSource } from '../core/seededRandom';
import type { View } from '../presentation/view';
import { type Stone, stoneLayout } from './stoneLayout';

// Colours for the practice stage: deep night-blue stone (FR-17).
const MORTAR = '#03050b';
const STONE_HUE = 226;
const STONE_SATURATION = 28;
const STONE_LIGHTNESS = 14;
/** Each stone is lit from the upper left: its top-left is this much lighter than its bottom-right. */
const STONE_SHADE_SPREAD = 5;
const BEVEL_LIGHT = 'rgba(170, 190, 255, 0.07)';
const BEVEL_DARK = 'rgba(0, 0, 0, 0.4)';
const GRAIN_LIGHT_RGB = '200, 210, 255';
const MOONLIGHT_RGB = '120, 150, 255';
const VIGNETTE_RGB = '1, 2, 8';

/**
 * Draws the practice stage background into a new canvas at the view's size and
 * pixel ratio. Expensive, so callers cache the result and redraw only on resize.
 */
export function renderPracticeBackground(view: View): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(view.width * view.pixelRatio));
  canvas.height = Math.max(1, Math.round(view.height * view.pixelRatio));
  const g = canvas.getContext('2d', { alpha: false });
  if (!g) return canvas;
  g.scale(view.pixelRatio, view.pixelRatio);

  const random = createSeededRandom(STAGE_LOOK.seed);
  g.fillStyle = MORTAR;
  g.fillRect(0, 0, view.width, view.height);
  for (const stone of stoneLayout(view.aspect, random, STAGE_LOOK)) {
    drawStone(g, view, stone, random);
  }
  drawLighting(g, view);
  return canvas;
}

function drawStone(g: CanvasRenderingContext2D, view: View, stone: Stone, random: RandomSource) {
  const px = view.lengthToPx.bind(view);
  const mortar = px(STAGE_LOOK.mortarWidth);
  const jitter = (): number => random() * px(STAGE_LOOK.edgeJitter);
  const left = px(stone.x) + mortar / 2 + jitter();
  const top = px(stone.y) + mortar / 2 + jitter();
  const right = px(stone.x + stone.w) - mortar / 2 - jitter();
  const bottom = px(stone.y + stone.h) - mortar / 2 - jitter();
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) return;

  const lightness = STONE_LIGHTNESS * (1 + stone.tone * STAGE_LOOK.stoneToneVariation);
  const shade = g.createLinearGradient(left, top, right, bottom);
  shade.addColorStop(0, stoneColor(lightness + STONE_SHADE_SPREAD / 2));
  shade.addColorStop(1, stoneColor(lightness - STONE_SHADE_SPREAD / 2));

  g.save();
  g.beginPath();
  g.roundRect(left, top, w, h, h * STAGE_LOOK.cornerRadius);
  g.fillStyle = shade;
  g.fill();
  g.clip();

  drawMottles(g, left, top, w, h, random);
  drawGrain(g, left, top, w, h, random);

  // Bevel: a faint lit top edge and a shadowed bottom edge give each block depth.
  const edge = Math.max(1, mortar * 0.7);
  g.fillStyle = BEVEL_LIGHT;
  g.fillRect(left, top, w, edge);
  g.fillStyle = BEVEL_DARK;
  g.fillRect(left, bottom - edge, w, edge);
  g.restore();
}

const stoneColor = (lightness: number): string =>
  `hsl(${STONE_HUE} ${STONE_SATURATION}% ${Math.max(0, lightness).toFixed(1)}%)`;

function drawMottles(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  random: RandomSource,
): void {
  for (let i = 0; i < STAGE_LOOK.mottlesPerStone; i++) {
    const cx = x + random() * w;
    const cy = y + random() * h;
    const r = h * (0.4 + random() * 0.8);
    const rgb = random() > 0.5 ? GRAIN_LIGHT_RGB : '0, 0, 0';
    const mottle = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    mottle.addColorStop(0, `rgba(${rgb}, ${STAGE_LOOK.mottleAlpha})`);
    mottle.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = mottle;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

function drawGrain(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  random: RandomSource,
): void {
  for (let i = 0; i < STAGE_LOOK.grainPerStone; i++) {
    g.fillStyle =
      random() > 0.5
        ? `rgba(${GRAIN_LIGHT_RGB}, ${STAGE_LOOK.grainAlpha})`
        : `rgba(0, 0, 0, ${STAGE_LOOK.grainAlpha * 2})`;
    const size = 1 + random() * 2;
    g.fillRect(x + random() * (w - size), y + random() * (h - size), size, size);
  }
}

function drawLighting(g: CanvasRenderingContext2D, view: View): void {
  const { width: w, height: h } = view;

  // Cool moonlight from above the stage: the wall is brighter near the top centre.
  const mx = w / 2;
  const my = h * STAGE_LOOK.moonlightY;
  const moonlight = g.createRadialGradient(
    mx,
    my,
    0,
    mx,
    my,
    view.lengthToPx(STAGE_LOOK.moonlightRadius),
  );
  moonlight.addColorStop(0, `rgba(${MOONLIGHT_RGB}, ${STAGE_LOOK.moonlightAlpha})`);
  moonlight.addColorStop(1, `rgba(${MOONLIGHT_RGB}, 0)`);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = moonlight;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';

  g.fillStyle = `rgba(0, 0, 0, ${STAGE_LOOK.dimAlpha})`;
  g.fillRect(0, 0, w, h);

  const halfDiagonal = Math.hypot(w, h) / 2;
  const vignette = g.createRadialGradient(
    w / 2,
    h / 2,
    halfDiagonal * STAGE_LOOK.vignetteInner,
    w / 2,
    h / 2,
    halfDiagonal * STAGE_LOOK.vignetteOuter,
  );
  vignette.addColorStop(0, `rgba(${VIGNETTE_RGB}, 0)`);
  vignette.addColorStop(1, `rgba(${VIGNETTE_RGB}, ${STAGE_LOOK.vignetteAlpha})`);
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);
}
