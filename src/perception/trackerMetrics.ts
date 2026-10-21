import { DEBUG, TRACKING } from '../config/tuning';
import { createFpsMeter } from '../core/fpsMeter';
import { createRollingStats } from '../core/rollingStats';

// The tracker's timing numbers (FR-23, T4). Pure: times come in, numbers come out.
//
// - Latency: capture → result on the main thread (what the trail and skeleton wait for).
// - Skew: how far the live picture is ahead of the skeleton drawn on it, i.e. the newest
//   presented frame's capture time minus the analysed frame's, when its result arrives.
//   Zero on the main thread (it detects the frame it was handed, synchronously).

/** One reading of every number. */
export interface MetricsSnapshot {
  /** Detections completed per second. */
  trackingFps: number;
  /** New video frames per second (the camera's real rate). */
  videoFps: number;
  /** Time per detection where it runs, after the first few. */
  detectMeanMs: number;
  detectP95Ms: number;
  /** The first real detection after a (re)start. */
  firstDetectMs: number | null;
  latencyMs: number;
  skewMs: number;
  skewP95Ms: number;
}

/** The tracker's meters. */
export interface TrackerMetrics {
  /** A new camera frame was presented. */
  videoFrame(now: number, captureTime: number): void;
  /** A result arrived for the frame captured at `captureTime`. */
  result(now: number, captureTime: number, detectMs: number): void;
  /** A new backend or delegate: start the detection numbers over (never mix two). */
  reset(): void;
  trackingFps(now: number): number;
  read(now: number): MetricsSnapshot;
}

/** Creates the meters. */
export function createTrackerMetrics(): TrackerMetrics {
  const detectMs = createRollingStats(TRACKING.detectStatsWindow);
  const latency = createRollingStats(TRACKING.detectStatsWindow);
  const skew = createRollingStats(TRACKING.detectStatsWindow);
  const trackingMeter = createFpsMeter(DEBUG.fpsWindowMs);
  const videoMeter = createFpsMeter(DEBUG.fpsWindowMs);
  let detections = 0;
  let firstDetectMs: number | null = null;
  let latestCapture = 0;

  return {
    videoFrame(now, captureTime) {
      videoMeter.tick(now);
      latestCapture = captureTime;
    },
    result(now, captureTime, ms) {
      detections++;
      trackingMeter.tick(now);
      if (detections === 1) firstDetectMs = ms;
      if (detections > TRACKING.warmupDetections) detectMs.add(ms);
      latency.add(now - captureTime);
      skew.add(Math.max(0, latestCapture - captureTime));
    },
    reset() {
      detectMs.clear();
      latency.clear();
      skew.clear();
      detections = 0;
      firstDetectMs = null;
    },
    trackingFps: (now) => trackingMeter.read(now),
    read(now) {
      return {
        trackingFps: trackingMeter.read(now),
        videoFps: videoMeter.read(now),
        detectMeanMs: detectMs.mean(),
        detectP95Ms: detectMs.p95(),
        firstDetectMs,
        latencyMs: latency.mean(),
        skewMs: skew.mean(),
        skewP95Ms: skew.p95(),
      };
    },
  };
}
