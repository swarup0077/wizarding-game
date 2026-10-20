import { STAGE_LOOK } from '../config/tuning';
import { createSeededRandom, type RandomSource } from '../core/seededRandom';
import type { View } from '../presentation/view';
import { drawPracticeLighting } from './practiceLighting';
import { type Stone, stoneLayout } from './stoneLayout';
import { crackPath, type Point, type Rect, stoneOutline } from './stoneShape';

// Colours for the practice stage: deep night-blue stone (FR-17).
const MORTAR = '#03050b';
const STONE_HUE = 226;
const STONE_SATURATION = 28;
const STONE_LIGHTNESS = 14;
/** Grey stones keep this share of the normal saturation. */
const GREY_SATURATION_SCALE = 0.5;
/** Each stone is lit from the upper left: its top-left is this much lighter than its bottom-right. */
const STONE_SHADE_SPREAD = 5;
const BEVEL_LIGHT = 'rgba(175, 195, 255, 0.10)';
const BEVEL_DARK = 'rgba(0, 0, 0, 0.45)';
const GRAIN_LIGHT_RGB = '200, 210, 255';
const MOSS_RGB = '70, 105, 62';
const CRACK_DARK = 'rgba(0, 0, 0, 0.6)';
const CRACK_LIGHT = 'rgba(160, 180, 240, 0.08)';

type Face = { rect: Rect; outline: Point[] };

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

  const stones = stoneLayout(view.aspect, random, STAGE_LOOK);
  const cracked = pickCrackedStones(stones, view.aspect, random);
  stones.forEach((stone, i) => {
    const face = stoneFace(view, stone, random);
    if (face) drawStone(g, stone, face, cracked.has(i), random);
  });
  drawPracticeLighting(g, view);
  return canvas;
}

/** Picks a few stones away from the stage edges to carry a crack. */
function pickCrackedStones(stones: Stone[], aspect: number, random: RandomSource): Set<number> {
  const candidates = stones
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.x > 0.15 && s.x + s.w < aspect - 0.15 && s.y > 0.15 && s.y + s.h < 0.85);
  const picked = new Set<number>();
  while (picked.size < Math.min(STAGE_LOOK.crackedStones, candidates.length)) {
    const choice = candidates[Math.floor(random() * candidates.length)];
    if (choice) picked.add(choice.i);
  }
  return picked;
}

function stoneFace(view: View, stone: Stone, random: RandomSource): Face | null {
  const half = view.lengthToPx(STAGE_LOOK.mortarWidth) / 2;
  const rect: Rect = {
    left: view.lengthToPx(stone.x) + half,
    top: view.lengthToPx(stone.y) + half,
    right: view.lengthToPx(stone.x + stone.w) - half,
    bottom: view.lengthToPx(stone.y + stone.h) - half,
  };
  if (rect.right - rect.left < 8 || rect.bottom - rect.top < 8) return null;
  return { rect, outline: stoneOutline(rect, random, STAGE_LOOK) };
}

function drawStone(
  g: CanvasRenderingContext2D,
  stone: Stone,
  { rect, outline }: Face,
  cracked: boolean,
  random: RandomSource,
): void {
  const grey = random() < STAGE_LOOK.greyChance;
  const mossy = stone.y > STAGE_LOOK.mossFromY && random() < STAGE_LOOK.mossChance;
  const hue = STONE_HUE + (random() * 2 - 1) * STAGE_LOOK.hueJitterDeg;
  const saturation = STONE_SATURATION * (grey ? GREY_SATURATION_SCALE : 1);
  const lightness = STONE_LIGHTNESS * (1 + stone.tone * STAGE_LOOK.stoneToneVariation);
  const colour = (l: number): string =>
    `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${Math.max(0, l).toFixed(1)}%)`;

  const shade = g.createLinearGradient(rect.left, rect.top, rect.right, rect.bottom);
  shade.addColorStop(0, colour(lightness + STONE_SHADE_SPREAD / 2));
  shade.addColorStop(1, colour(lightness - STONE_SHADE_SPREAD / 2));

  g.save();
  traceOutline(g, outline, STAGE_LOOK.cornerRadiusPx);
  g.fillStyle = shade;
  g.fill();
  g.clip();

  drawMottles(g, rect, random);
  if (mossy) drawMoss(g, rect, random);
  drawGrain(g, rect, random);
  if (cracked) drawCrack(g, crackPath(rect, random));
  drawBevel(g, outline);
  g.restore();
}

/** A closed path through the outline points with softly rounded corners. */
function traceOutline(g: CanvasRenderingContext2D, points: Point[], radius: number): void {
  const n = points.length;
  const at = (i: number): Point => points[((i % n) + n) % n] ?? { x: 0, y: 0 };
  const start = at(-1);
  const first = at(0);
  g.beginPath();
  g.moveTo((start.x + first.x) / 2, (start.y + first.y) / 2);
  for (let i = 0; i < n; i++) {
    const corner = at(i);
    const next = at(i + 1);
    g.arcTo(corner.x, corner.y, (corner.x + next.x) / 2, (corner.y + next.y) / 2, radius);
  }
  g.closePath();
}

/**
 * Inside the clipped stone, stroke the outline shifted down-right with a light colour
 * (only its top and left sides stay inside the stone) and shifted up-left with a dark
 * one (only its bottom and right sides stay inside).
 */
function drawBevel(g: CanvasRenderingContext2D, outline: Point[]): void {
  const e = STAGE_LOOK.bevelPx;
  g.lineWidth = e * 2;
  for (const [offset, colour] of [
    [e, BEVEL_LIGHT],
    [-e, BEVEL_DARK],
  ] as const) {
    g.save();
    g.translate(offset, offset);
    traceOutline(g, outline, STAGE_LOOK.cornerRadiusPx);
    g.strokeStyle = colour;
    g.stroke();
    g.restore();
  }
}

function drawMottles(g: CanvasRenderingContext2D, r: Rect, random: RandomSource): void {
  const h = r.bottom - r.top;
  for (let i = 0; i < STAGE_LOOK.mottlesPerStone; i++) {
    const rgb = random() > 0.5 ? GRAIN_LIGHT_RGB : '0, 0, 0';
    const x = r.left + random() * (r.right - r.left);
    const y = r.top + random() * h;
    softSpot(g, x, y, h * (0.4 + random() * 0.8), rgb, STAGE_LOOK.mottleAlpha);
  }
}

/** Faint green patches gathered along the stone's lower edge, where damp collects. */
function drawMoss(g: CanvasRenderingContext2D, r: Rect, random: RandomSource): void {
  const h = r.bottom - r.top;
  const patches = 2 + Math.floor(random() * 3);
  for (let i = 0; i < patches; i++) {
    const x = r.left + random() * (r.right - r.left);
    const y = r.bottom - random() * h * 0.3;
    softSpot(g, x, y, h * (0.35 + random() * 0.4), MOSS_RGB, STAGE_LOOK.mossAlpha);
  }
}

function softSpot(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha: number,
): void {
  const spot = g.createRadialGradient(x, y, 0, x, y, radius);
  spot.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  spot.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = spot;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawGrain(g: CanvasRenderingContext2D, r: Rect, random: RandomSource): void {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  for (let i = 0; i < STAGE_LOOK.grainPerStone; i++) {
    g.fillStyle =
      random() > 0.5
        ? `rgba(${GRAIN_LIGHT_RGB}, ${STAGE_LOOK.grainAlpha})`
        : `rgba(0, 0, 0, ${STAGE_LOOK.grainAlpha * 2})`;
    const size = 1 + random() * 2;
    g.fillRect(r.left + random() * (w - size), r.top + random() * (h - size), size, size);
  }
}

/** A dark crack line with a faint lit lip just below it, so it reads as a groove. */
function drawCrack(g: CanvasRenderingContext2D, points: Point[]): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [dy, colour, width] of [
    [1, CRACK_LIGHT, 1],
    [0, CRACK_DARK, 1.3],
  ] as const) {
    g.beginPath();
    points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y + dy) : g.lineTo(p.x, p.y + dy)));
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.stroke();
  }
}
