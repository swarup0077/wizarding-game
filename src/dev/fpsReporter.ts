import { DEBUG } from '../config/tuning';
import { createFpsMeter } from '../core/fpsMeter';

const REPORT_EVERY_MS = 1000;

/**
 * Dev: logs render fps and the longest frame gap once a second, as
 * `[fps] 59.8 maxGapMs 17.2 workMs 1.4 at 12345` (enabled with `?reportFps=1`). The average hides
 * stalls; the longest gap shows them. Chrome copies these lines to its log, which is
 * how fps is measured on real hardware without a person reading the overlay.
 */
export function createFpsReporter(frameWorkMs: () => number): (rafTime: number) => void {
  const meter = createFpsMeter(DEBUG.fpsWindowMs);
  let lastReport = -Infinity;
  let lastFrame: number | null = null;
  let maxGap = 0;
  let workSum = 0;
  let frames = 0;
  return (t) => {
    workSum += frameWorkMs();
    frames++;
    meter.tick(t);
    if (lastFrame !== null) maxGap = Math.max(maxGap, t - lastFrame);
    lastFrame = t;
    if (t - lastReport < REPORT_EVERY_MS) return;
    lastReport = t;
    const work = frames > 0 ? workSum / frames : 0;
    console.info(
      `[fps] ${meter.read(t).toFixed(1)} maxGapMs ${maxGap.toFixed(1)} workMs ${work.toFixed(2)} at ${t.toFixed(0)}`,
    );
    maxGap = 0;
    workSum = 0;
    frames = 0;
  };
}
