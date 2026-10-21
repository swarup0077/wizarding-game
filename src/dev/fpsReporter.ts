import { DEBUG } from '../config/tuning';
import { createFpsMeter } from '../core/fpsMeter';
import type { TrackerStats } from '../perception/handTracker';

const REPORT_EVERY_MS = 1000;

/**
 * Dev: logs render fps and the longest frame gap once a second, as
 * `[fps] 59.8 maxGapMs 17.2 workMs 1.4 wallGapMs 18.1 late 0 at 12345` (enabled with
 * `?reportFps=1`). The average hides stalls; the longest gap shows them. Chrome copies these
 * lines to its log, which is how fps is measured on real hardware without a person reading
 * the overlay.
 *
 * Two kinds of gap (T4): `maxGapMs` compares rAF timestamps, which Chrome aligns to vsync, so
 * it misses a frame whose callback ran late because a long task (a hand detection) ran just
 * before it in the same rendering step. `wallGapMs` and `late` (callbacks more than
 * DEBUG.lateFrameMs after the previous one) use the real time each callback ran, so they show
 * that stutter.
 * With a hand tracker it also logs
 * `[track] state ready delegate GPU fps 29.8 videoFps 30.0 detectMean 12.3 detectP95 15.1 firstMs 340 hand 1 at 12345`.
 */
export function createFpsReporter(
  frameWorkMs: () => number,
  tracking?: () => TrackerStats,
): (rafTime: number) => void {
  const meter = createFpsMeter(DEBUG.fpsWindowMs);
  let lastReport = -Infinity;
  let lastFrame: number | null = null;
  let lastWall: number | null = null;
  let maxGap = 0;
  let maxWallGap = 0;
  let late = 0;
  let workSum = 0;
  let frames = 0;
  return (t) => {
    workSum += frameWorkMs();
    frames++;
    meter.tick(t);
    if (lastFrame !== null) maxGap = Math.max(maxGap, t - lastFrame);
    lastFrame = t;
    const wall = performance.now();
    if (lastWall !== null) {
      const gap = wall - lastWall;
      maxWallGap = Math.max(maxWallGap, gap);
      if (gap > DEBUG.lateFrameMs) late++;
    }
    lastWall = wall;
    if (t - lastReport < REPORT_EVERY_MS) return;
    lastReport = t;
    const work = frames > 0 ? workSum / frames : 0;
    console.info(
      `[fps] ${meter.read(t).toFixed(1)} maxGapMs ${maxGap.toFixed(1)} workMs ${work.toFixed(2)} wallGapMs ${maxWallGap.toFixed(1)} late ${late} at ${t.toFixed(0)}`,
    );
    if (tracking) console.info(trackLine(tracking(), t));
    maxGap = 0;
    maxWallGap = 0;
    late = 0;
    workSum = 0;
    frames = 0;
  };
}

function trackLine(s: TrackerStats, t: number): string {
  return (
    `[track] state ${s.state} delegate ${s.delegate ?? '-'} fps ${s.trackingFps.toFixed(1)} ` +
    `videoFps ${s.videoFps.toFixed(1)} detectMean ${s.detectMeanMs.toFixed(2)} ` +
    `detectP95 ${s.detectP95Ms.toFixed(2)} firstMs ${s.firstDetectMs?.toFixed(0) ?? '-'} ` +
    `hand ${s.handSeen ? 1 : 0} at ${t.toFixed(0)}`
  );
}
