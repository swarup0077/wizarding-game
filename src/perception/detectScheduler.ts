// When to run hand detection (FR-2). Pure: the tracker asks it about every video frame.
//
// Three rules:
// - Each video frame is analysed at most once (the rAF fallback can see the same frame twice).
// - A detection never starts while one is still running. On the main thread
//   `detectForVideo` is synchronous, so this can't happen today; the gate matters while the
//   landmarker is being (re)created, and for any later worker, where detection is async.
// - Timestamps strictly increase, as MediaPipe's VIDEO mode requires, even when two frames
//   arrive in the same millisecond or the clock is read twice in a row across a restart.

/** Gate and clock for detections. */
export interface DetectScheduler {
  /**
   * Called for each new video frame. Returns the timestamp (ms) to pass to MediaPipe, or
   * null to skip the frame (already seen, or a detection is running). A non-null result
   * marks a detection as running until `finish()`.
   */
  begin(frameId: number, nowMs: number): number | null;
  /** The detection started by `begin()` ended (successfully or not). */
  finish(): void;
  /** True while a detection is running. */
  busy(): boolean;
  /** The video source changed (camera restarted): frame ids start over. Timestamps never do. */
  resetFrames(): void;
}

/** Creates a scheduler. */
export function createDetectScheduler(): DetectScheduler {
  let lastTimestamp = -Infinity;
  let lastFrameId: number | null = null;
  let running = false;

  return {
    begin(frameId, nowMs) {
      if (running || frameId === lastFrameId) return null;
      lastFrameId = frameId;
      running = true;
      lastTimestamp = Math.max(Math.round(nowMs), lastTimestamp + 1);
      return lastTimestamp;
    },
    finish() {
      running = false;
    },
    busy: () => running,
    resetFrames() {
      lastFrameId = null;
    },
  };
}
