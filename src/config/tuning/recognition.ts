// Tunable numbers for the recognition layer (traces, gesture recognizers, templates, fusion, quality).
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

/** FR-8: a valid trace. */
export const TRACE = {
  minDurationMs: 150,
  maxDurationMs: 3000,
  minPathLength: 0.12,
  minPoints: 12,
};

/** FR-9 and FR-10: gesture recognizers and the shared accept rule. */
export const RECOGNIZER = {
  /** The best spell must beat the next different spell by this much. */
  acceptMargin: 0.05,
  protractor: {
    resamplePoints: 32,
    threshold: 0.8,
  },
  dollarOne: {
    resamplePoints: 64,
    threshold: 0.8,
    /** Side of the reference square traces are scaled to. */
    squareSize: 1,
    /** Golden-section search stops when the bracket is this narrow. */
    searchPrecisionDeg: 2,
    /** Above this tolerance, scan coarsely first (golden-section assumes one minimum). */
    coarseScanAboveDeg: 45,
    /** Coarse scan step. Initial guess, tuned in T7. */
    coarseScanStepDeg: 15,
  },
};

/** FR-10 and FR-11: gesture templates. */
export const TEMPLATES = {
  jitteredVariantsPerShape: 2,
  /** Jitter applied to the generated variants. Initial guess, tuned in T7. */
  jitterAmount: 0.03,
  minPersonalPerSpell: 5,
};

/** FR-14: cast fusion. */
export const FUSION = {
  pairWindowMs: 1500,
  interimMinScore: 0.85,
  finalMinScore: 0.7,
};

/** FR-15: quality and tiers. */
export const QUALITY = {
  /** voiceN = clamp((score − voiceFloor) / voiceSpan). */
  voiceFloor: 0.7,
  voiceSpan: 0.25,
  /** Speed marks fall linearly to 0 at these trace durations. */
  speedZeroAtShortMs: 150,
  speedZeroAtLongMs: 3000,
  defaultWeights: { shape: 0.6, voice: 0.3, speed: 0.1 },
  defaultGestureOnlyWeights: { shape: 0.85, speed: 0.15 },
  /** q below this is weak... */
  weakBelow: 0.35,
  /** ...below this is normal, otherwise strong. */
  normalBelow: 0.75,
};
