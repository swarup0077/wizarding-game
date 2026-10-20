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
}

/**
 * Lays out a running-bond stone wall covering a stage of the given aspect.
 * Each row starts at a random offset left of the stage edge and continues past
 * the right edge, so the wall has no gaps at any size.
 */
export function stoneLayout(
  aspect: number,
  random: RandomSource,
  options: StoneLayoutOptions,
): Stone[] {
  const { stoneHeight: h, stoneWidthMin: minW, stoneWidthMax: maxW } = options;
  const stones: Stone[] = [];
  for (let y = 0; y < 1; y += h) {
    let x = -random() * maxW;
    while (x < aspect) {
      const w = minW + random() * (maxW - minW);
      stones.push({ x, y, w, h, tone: random() - 0.5 });
      x += w;
    }
  }
  return stones;
}
