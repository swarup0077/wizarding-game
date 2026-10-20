// Tunable numbers for the perception layer (hand tracking, wand point, pinch, calibration, voice listener and matcher).
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

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

/** FR-12 and FR-13: voice listener and matcher. */
export const VOICE = {
  maxAlternatives: 3,
  /** First restart after Chrome ends a session is immediate; repeated errors back off. Initial guess, tuned in T9. */
  restartBackoffStartMs: 250,
  restartBackoffMaxMs: 4000,
  matchThreshold: 0.7,
  maxWindowWords: 3,
};
