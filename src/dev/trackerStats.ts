import { PERFORMANCE } from '../config/tuning';
import type { TrackerStats } from '../perception/handTracker';
import type { DebugOverlay } from './debugOverlay';

const THREAD_LABEL = { worker: 'Worker', main: 'Main thread' } as const;

/** Debug rows for hand tracking (FR-23): where it runs, tracking fps, detection time, timing. */
export function addTrackerStats(overlay: DebugOverlay, stats: () => TrackerStats): void {
  overlay.addStat('Tracker', () => {
    const s = stats();
    return s.state === 'failed' ? `failed: ${s.failure ?? '?'}` : s.state;
  });
  overlay.addStat(
    'Delegate',
    () => {
      const s = stats();
      if (!s.thread || !s.delegate) return '–';
      const notes: string[] = [];
      if (s.thread === 'main' && s.workerError) notes.push(`worker failed: ${s.workerError}`);
      else if (s.workerRestarts > 0) notes.push(`worker restarted ×${s.workerRestarts}`);
      if (s.gpuError && s.delegate !== 'GPU') notes.push(`GPU failed: ${s.gpuError}`);
      const where = `${THREAD_LABEL[s.thread]} · ${s.delegate}`;
      return notes.length ? `${where} (${notes.join('; ')})` : where;
    },
    // Green only when detection is off the main thread.
    () => (stats().thread ? stats().thread === 'worker' : null),
  );
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
  overlay.addStat('Start: load / warm-up', () => {
    const s = stats();
    if (s.loadMs === null || s.warmupMs === null) return '–';
    return `${s.loadMs.toFixed(0)} / ${s.warmupMs.toFixed(0)} ms`;
  });
  overlay.addStat('First detection', () => {
    const ms = stats().firstDetectMs;
    return ms === null ? '–' : `${ms.toFixed(0)} ms`;
  });
  overlay.addStat('Capture → result', () => {
    const s = stats();
    return s.latencyMs === 0 ? '–' : `${s.latencyMs.toFixed(0)} ms`;
  });
  overlay.addStat('Skeleton skew', () => {
    const s = stats();
    if (s.latencyMs === 0) return '–';
    return `${s.skewMs.toFixed(0)} mean / ${s.skewP95Ms.toFixed(0)} p95 ms`;
  });
  overlay.addStat('Hand', () => (stats().handSeen ? 'seen' : '–'));
}
