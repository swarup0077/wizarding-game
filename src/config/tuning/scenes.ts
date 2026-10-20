// Tunable numbers for scenes (the practice stage look).
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

/** FR-17: the practice stage's look. Lengths in square units. Initial guesses, judged by eye in T1. */
export const STAGE_LOOK = {
  /** Fixed seed, so the stone wall looks the same on every load and machine. */
  seed: 1729,
  stoneHeight: 0.11,
  /** Each row's height varies by up to ± this fraction. */
  rowHeightVariation: 0.15,
  stoneWidthMin: 0.16,
  stoneWidthMax: 0.34,
  mortarWidth: 0.006,
  /** Each corner moves inward by this many CSS px, so blocks look hand-cut. */
  cornerJitterPxMin: 1,
  cornerJitterPxMax: 2,
  /** Chance that a corner is chipped off, and the chip's size in CSS px. */
  chipChance: 0.12,
  chipSizePxMin: 4,
  chipSizePxMax: 9,
  /** Corner rounding in CSS px. */
  cornerRadiusPx: 2.5,
  /** Lit top/left and shadowed bottom/right edge width, in CSS px. */
  bevelPx: 1.5,
  /** Stones with a crack running in from one edge. */
  crackedStones: 3,
  /** How much each stone's brightness varies, 0–1. */
  stoneToneVariation: 0.5,
  /** Random hue shift per stone, ± degrees. */
  hueJitterDeg: 6,
  /** Share of stones that are a cooler, less saturated grey. */
  greyChance: 0.25,
  /** Below this height (normalized y), stones may be faintly mossy... */
  mossFromY: 0.7,
  /** ...with this chance... */
  mossChance: 0.3,
  /** ...and this strength. */
  mossAlpha: 0.14,
  /** Soft darker/lighter patches per stone. */
  mottlesPerStone: 3,
  mottleAlpha: 0.08,
  /** Grain speckles per stone. */
  grainPerStone: 18,
  grainAlpha: 0.06,
  /** Moonlight shaft from the upper left: origin (square units), direction, reach, width, strength. */
  shaftOriginX: -0.1,
  shaftOriginY: -0.05,
  shaftAngleDeg: 28,
  shaftLength: 2.0,
  shaftWidth: 0.55,
  shaftAlpha: 0.2,
  /** Vignette: clear inside this radius, darkest at the outer radius (fractions of the half-diagonal). */
  vignetteInner: 0.22,
  vignetteOuter: 1.0,
  vignetteAlpha: 0.96,
  /** Overall darkening so the stage reads as dim (D-017). 0 = none, 1 = black. */
  dimAlpha: 0.32,
};
