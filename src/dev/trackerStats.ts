import { PERFORMANCE } from '../config/tuning';
import type { TrackerStats } from '../perception/handTracker';
import type { DebugOverlay } from './debugOverlay';

/** Debug rows for hand tracking (FR-23): state, delegate, tracking fps, detection time. */
export function addTrackerStats(overlay: DebugOverlay, stats: () => TrackerStats): void {
  overlay.addStat('Tracker', () => {
    const s = stats();
    return s.state === 'failed' ? `failed: ${s.failure ?? '?'}` : s.state;
  });
  overlay.addStat('Delegate', () => {
    const s = stats();
    if (!s.delegate) return '–';
    return s.gpuError && s.delegate !== 'GPU'
      ? `${s.delegate} (GPU failed: ${s.gpuError})`
      : s.delegate;
  });
  overlay.addStat(
    'Tracking fps',
    () => {
      const s = stats();
      if (s.state !== 'ready') return '–';
      return `${s.trackingFps.toFixed(0)} (video ${s.videoFps.toFixed(0)})`;
    },
    () => {
      const s = stats();
      return s.state === 'ready' ? s.trackingFps >= PERFORMANCE.trackingFpsTarget : null;
    },
  );
  overlay.addStat('Detection', () => {
    const s = stats();
    if (s.detectMeanMs === 0) return '–';
    return `${s.detectMeanMs.toFixed(1)} mean / ${s.detectP95Ms.toFixed(1)} p95 ms`;
  });
  overlay.addStat('First detection', () => {
    const ms = stats().firstDetectMs;
    return ms === null ? '–' : `${ms.toFixed(0)} ms`;
  });
  overlay.addStat('Hand', () => (stats().handSeen ? 'seen' : '–'));
}
