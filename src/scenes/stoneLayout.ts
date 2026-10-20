import type { RandomSource } from '../core/seededRandom';

/** One stone block in square units (x from 0 to aspect, y from 0 to 1). */
export interface Stone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Brightness variation for this stone, in [-0.5, 0.5]. */
  tone: number;
}

/** Sizes that shape the wall, in square units. */
export interface StoneLayoutOptions {
  stoneHeight: number;
  stoneWidthMin: number;
  stoneWidthMax: number;
  /** Each row's height varies by up to ± this fraction of `stoneHeight`. Default 0. */
  rowHeightVariation?: number;
}

/**
 * Lays out a running-bond stone wall covering a stage of the given aspect.
 * Rows stack with no gaps; each row starts at a random offset left of the stage
 * edge and continues past the right edge, so the wall has no gaps at any size.
 */
export function stoneLayout(
  aspect: number,
  random: RandomSource,
  options: StoneLayoutOptions,
): Stone[] {
  const { stoneHeight, stoneWidthMin: minW, stoneWidthMax: maxW } = options;
  const variation = options.rowHeightVariation ?? 0;
  const stones: Stone[] = [];
  for (let y = 0; y < 1;) {
    const h = stoneHeight * (1 + (random() * 2 - 1) * variation);
    let x = -random() * maxW;
    while (x < aspect) {
      const w = minW + random() * (maxW - minW);
      stones.push({ x, y, w, h, tone: random() - 0.5 });
      x += w;
    }
    y += h;
  }
  return stones;
}
