// Tunable numbers for the input layer (webcam request, wand sampling and interpolation).
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

/** FR-1: webcam request. */
export const CAMERA = {
  idealWidth: 640,
  idealHeight: 480,
  idealFps: 30,
};

/** FR-18 and FR-6: input sampling and render-time interpolation. */
export const INPUT = {
  /** The hand-tracking rate the 30 Hz preview simulates. */
  handRateHz: 30,
  /**
   * The trail is drawn this many input intervals in the past, so it can interpolate.
   * Above 1 leaves a margin for uneven frame timing (camera jitter).
   */
  renderDelayIntervals: 1.25,
  renderDelayMinMs: 4,
  renderDelayMaxMs: 50,
  /** Smoothing of the measured input interval (0–1, higher follows faster). */
  rateSmoothing: 0.15,
  /** Samples further apart than this belong to separate bursts and don't update the rate. */
  rateGapMs: 200,
  /** Samples closer than this (e.g. a final position and the release) don't update the rate. */
  rateMinGapMs: 4,
};
