// Tunable numbers for dev tools and performance targets.
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

/** NFR-1 and NFR-2: targets the debug overlay compares against. */
export const PERFORMANCE = {
  trackingFpsTarget: 25,
  renderFpsTarget: 55,
  trailLagTargetMs: 100,
  effectStartTargetMs: 150,
};

/** FR-23: debug overlay. */
export const DEBUG = {
  hiddenBudgetMs: 1,
  /** How often the overlay's HTML text refreshes. Initial guess, tuned in T1. */
  textRefreshHz: 4,
  /** fps is averaged over this sliding window. */
  fpsWindowMs: 1000,
  eventLogSize: 20,
  /** The synchronized preview's draw time and lag are averaged over this many pictures. */
  previewStatsWindow: 120,
  /** `?reportFps=1`: a frame whose callback runs this long after the previous one is late (a visible hitch). */
  lateFrameMs: 25,
};

/** `?dev=camera`: the camera dev trigger (screenshots, checking messages). */
export const DEV_CAMERA = {
  /** With `&simulate=ended`, the camera track is ended this long after it goes live. */
  simulateEndedAfterMs: 2000,
};
