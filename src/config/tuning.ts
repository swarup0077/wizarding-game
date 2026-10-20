// Every tunable number in the game, grouped by layer. No magic numbers elsewhere.
// Distances are in square units (1 = stage height) unless a name says otherwise.
// Values marked "initial guess" are not given by the spec and get tuned in the named task.
// Per-spell numbers (ideal durations, rotation tolerances) are spell data in spells.ts.

/** FR-1: webcam request. */
export const CAMERA = {
  idealWidth: 640,
  idealHeight: 480,
  idealFps: 30,
};

/** FR-2: hand tracking. */
export const TRACKING = {
  numHands: 1,
  /** Show the lighting tip when tracking fps stays below this... */
  lowFpsThreshold: 20,
  /** ...for this long. */
  lowFpsWindowMs: 3000,
  /** Comfortable hand distance from the camera, quoted in the tip. */
  handDistanceCmMin: 40,
  handDistanceCmMax: 80,
};

/** NFR-1 and NFR-2: targets the debug overlay compares against. */
export const PERFORMANCE = {
  trackingFpsTarget: 25,
  renderFpsTarget: 55,
  trailLagTargetMs: 100,
  effectStartTargetMs: 150,
};

/** FR-3: One Euro filter on the wand point. Initial guess, tuned in T5. */
export const ONE_EURO = {
  minCutoffHz: 1.0,
  beta: 5,
  derivativeCutoffHz: 1.0,
};

/** FR-4: pinch hysteresis. Starting values for 2D landmarks; retuned in T5 (D-015). */
export const PINCH = {
  startRatio: 0.28,
  endRatio: 0.4,
  confirmFrames: 2,
};

/** FR-7: hand lost. */
export const HAND_LOST = {
  timeoutMs: 300,
};

/** FR-5: calibration box. */
export const CALIBRATION = {
  durationMs: 3000,
  lowPercentile: 0.05,
  highPercentile: 0.95,
  margin: 0.08,
  /** Minimum span per axis, in camera-normalized units. */
  minSpan: 0.25,
};

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

/** FR-12 and FR-13: voice listener and matcher. */
export const VOICE = {
  maxAlternatives: 3,
  /** First restart after Chrome ends a session is immediate; repeated errors back off. Initial guess, tuned in T9. */
  restartBackoffStartMs: 250,
  restartBackoffMaxMs: 4000,
  matchThreshold: 0.7,
  maxWindowWords: 3,
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

/** FR-19: spell effects. */
export const EFFECTS = {
  lumos: {
    durationMs: 10_000,
    /** Light radius for weak / normal / strong. Initial guess, tuned in T11. */
    orbRadiusByTier: { weak: 0.12, normal: 0.18, strong: 0.26 },
  },
  leviosa: {
    reach: 0.12,
    maxDurationMs: 8000,
    weakDurationMs: 3000,
    /** A pinch shorter than this drops the feather. */
    dropTapMaxMs: 250,
  },
  incendio: {
    /** Initial guess, tuned in T11. */
    burstRadius: 0.15,
    cobwebBurnMs: 1200,
    cobwebRespawnMs: 5000,
  },
};

/** FR-18: wand trail. */
export const TRAIL = {
  fadeMs: 350,
};

/** FR-20: HUD. */
export const HUD = {
  resultCardMs: 2000,
  /** Webcam PiP width as a fraction of the window width. */
  pipWidthFraction: 0.2,
};

/** FR-17: rendering. */
export const RENDER = {
  /** Device pixel ratio cap, protecting frame rate on integrated graphics. Initial guess, chosen in T1. */
  maxDevicePixelRatio: 1.5,
  /** Allowed range for the `?dprCap=` measuring override. */
  dprCapOverrideMin: 0.5,
  dprCapOverrideMax: 3,
  /** Longest time step one frame may advance (after a hidden tab or a stall). */
  maxFrameDtMs: 100,
  /** Redraw the cached background only after resizing has been still this long. */
  resizeSettleMs: 150,
};

/** FR-17: the practice stage's look. Lengths in square units. Initial guesses, judged by eye in T1. */
export const STAGE_LOOK = {
  /** Fixed seed, so the stone wall looks the same on every load and machine. */
  seed: 1729,
  stoneHeight: 0.11,
  stoneWidthMin: 0.16,
  stoneWidthMax: 0.34,
  mortarWidth: 0.006,
  /** Extra random inset per stone edge, so blocks look hand-cut rather than tiled. */
  edgeJitter: 0.004,
  /** Corner rounding as a fraction of stone height. */
  cornerRadius: 0.06,
  /** How much each stone's brightness varies, 0–1. */
  stoneToneVariation: 0.5,
  /** Soft darker/lighter patches per stone. */
  mottlesPerStone: 3,
  mottleAlpha: 0.08,
  /** Grain speckles per stone. */
  grainPerStone: 18,
  grainAlpha: 0.06,
  /** Cool light from above: centre height (normalized y), radius (square units), strength. */
  moonlightY: -0.15,
  moonlightRadius: 1.1,
  moonlightAlpha: 0.12,
  /** Vignette: clear inside this radius, darkest at the outer radius (fractions of the half-diagonal). */
  vignetteInner: 0.3,
  vignetteOuter: 1.05,
  vignetteAlpha: 0.85,
  /** Overall darkening so the stage reads as dim (D-017). 0 = none, 1 = black. */
  dimAlpha: 0.32,
};

/** FR-23: debug overlay. */
export const DEBUG = {
  hiddenBudgetMs: 1,
  /** How often the overlay's HTML text refreshes. Initial guess, tuned in T1. */
  textRefreshHz: 4,
  /** fps is averaged over this sliding window. */
  fpsWindowMs: 1000,
  eventLogSize: 20,
};
