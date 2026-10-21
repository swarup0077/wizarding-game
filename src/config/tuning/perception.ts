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
  /** Tracking counts as recovered after this long at or above the threshold. */
  lowFpsRecoverMs: 3000,
  /** After tracking (re)starts, ignore fps this long: the meter needs a full window first. */
  lowFpsStartGraceMs: 1500,
  /** How often the slow-tracking check runs while tracking. */
  lowFpsCheckMs: 250,
  /** Detection mean / p95 are taken over this many recent detections (~4 s at 30 fps). */
  detectStatsWindow: 120,
  /** The first detections compile GPU shaders and warm caches: reported apart, not averaged. */
  warmupDetections: 3,
  /** Size of the blank frame the landmarker warms up on before it reports ready (the camera's ideal size). */
  warmupWidthPx: 640,
  warmupHeightPx: 480,
  /** T4 worker: give up on a starting worker after this long (fresh profile: download + ~3 s GPU warm-up)... */
  workerReadyTimeoutMs: 30_000,
  /** ...or on a running one whose result is this late (crash or hang). */
  workerResultTimeoutMs: 2000,
  /** A failed worker is restarted this many times before detection falls back to the main thread. */
  workerRestarts: 1,
  /** Dev (`?simulateTracker=`): how long after the worker is ready it fails on purpose. */
  simulateFailureAfterMs: 4000,
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
