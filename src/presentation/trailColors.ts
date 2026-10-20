/** An RGB colour, each channel 0–255. */
export type Rgb = readonly [number, number, number];

/** How a finished stroke ends (FR-18): plain fade, gold flash (recognized) or grey (not). */
export type ReleaseOutcome = 'fade' | 'gold' | 'grey';

// The trail's palette: warm gold-white at the head, gold, then amber at the tail.
const HEAD_WARM: Rgb = [255, 240, 205];
const HEAD_HOT: Rgb = [255, 251, 242];
const GOLD: Rgb = [255, 196, 96];
const AMBER: Rgb = [228, 112, 42];
const FLASH_GOLD: Rgb = [255, 214, 120];
const ASH_GREY: Rgb = [140, 146, 162];
/** Where along the trail (0 head … 1 tail) the gold stop sits. */
const GOLD_AT = 0.2;

/** Linear blend between two colours. */
export function mixRgb(a: Rgb, b: Rgb, m: number): Rgb {
  const c = Math.min(1, Math.max(0, m));
  return [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c, a[2] + (b[2] - a[2]) * c];
}

/**
 * Trail colour at position `k` (0 head … 1 tail). Energy whitens the head (hotter);
 * `release` (0–1) blends toward the outcome colour after the stroke ends.
 */
export function trailColor(
  k: number,
  energy: number,
  outcome: ReleaseOutcome,
  release: number,
): Rgb {
  const head = mixRgb(HEAD_WARM, HEAD_HOT, energy * 0.6);
  const base =
    k < GOLD_AT
      ? mixRgb(head, GOLD, k / GOLD_AT)
      : mixRgb(GOLD, AMBER, (k - GOLD_AT) / (1 - GOLD_AT));
  if (outcome === 'gold') return mixRgb(base, FLASH_GOLD, release);
  if (outcome === 'grey') return mixRgb(base, ASH_GREY, release);
  return base;
}

/** The colour of a sparkle with warmth `w` (0 white-gold … 1 amber). */
export function sparkleColor(w: number): Rgb {
  return w < 0.5 ? mixRgb(HEAD_HOT, GOLD, w * 2) : mixRgb(GOLD, AMBER, (w - 0.5) * 2);
}

// Sprite colours use inputs rounded to these grids, so the set of sprites is finite and
// can be built in full at startup (a sprite built mid-stroke causes a visible hitch).
const K_STEPS = 40;
const ENERGY_STEPS = 8;
const RELEASE_STEPS = 16;
const WARMTH_STEPS = 32;
const snap = (v: number, steps: number): number =>
  Math.round(Math.min(1, Math.max(0, v)) * steps) / steps;
const grid = (steps: number): number[] => Array.from({ length: steps + 1 }, (_, i) => i / steps);

/** The trail colour used for a glow sprite: `trailColor` on rounded inputs. */
export function spriteColor(
  k: number,
  energy: number,
  outcome: ReleaseOutcome,
  release: number,
): Rgb {
  return trailColor(
    snap(k, K_STEPS),
    snap(energy, ENERGY_STEPS),
    outcome,
    snap(release, RELEASE_STEPS),
  );
}

/** The sparkle colour used for a sprite: `sparkleColor` on a rounded warmth. */
export function sparkleSpriteColor(warmth: number): Rgb {
  return sparkleColor(snap(warmth, WARMTH_STEPS));
}

/**
 * Every sprite colour the trail and sparkles can ask for. Grey releases are drawn at
 * energy 0 and gold releases are pure flash gold, matching how the trail layer styles them.
 */
export function reachableTrailColors(): { glow: Rgb[]; sparkle: Rgb[] } {
  const glow: Rgb[] = [trailColor(0, 0, 'gold', 1)];
  for (const k of grid(K_STEPS)) {
    for (const energy of grid(ENERGY_STEPS)) glow.push(trailColor(k, energy, 'fade', 0));
    for (const release of grid(RELEASE_STEPS)) glow.push(trailColor(k, 0, 'grey', release));
  }
  return { glow, sparkle: grid(WARMTH_STEPS).map(sparkleColor) };
}

/** Rounds a colour to a coarse grid, so a few cached sprites cover every shade. */
export function quantizeRgb(c: Rgb, step = 12): Rgb {
  const q = (v: number): number => Math.min(255, Math.round(v / step) * step);
  return [q(c[0]), q(c[1]), q(c[2])];
}

/** CSS `rgba()` text for a colour. */
export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0].toFixed(0)}, ${c[1].toFixed(0)}, ${c[2].toFixed(0)}, ${alpha.toFixed(3)})`;
}
