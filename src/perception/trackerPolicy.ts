import type { DetectionThread } from './detectors/backend';

// What the tracker does when its detection backend fails (T4, D-064). Pure.
//
// Order: worker (GPU, then CPU, inside the worker) → the worker restarted, up to
// `maxRestarts` times → the main thread (GPU, then CPU) → give up. A worker on the CPU
// still beats the main thread on the GPU: it never delays a rendered frame.

/** The next step after a failure. */
export type FailureStep = 'restart-worker' | 'main-thread' | 'give-up';

/** Decides the next step after the backend on `thread` failed, with `restarts` used so far. */
export function stepAfterFailure(
  thread: DetectionThread,
  restarts: number,
  maxRestarts: number,
  midSession: boolean,
): FailureStep {
  if (thread === 'main') return 'give-up';
  // A worker that never started won't start on a second try (missing script, no wasm):
  // only a worker that was running gets restarted.
  if (midSession && restarts < maxRestarts) return 'restart-worker';
  return 'main-thread';
}

/** Dev failures to rehearse (`?simulateTracker=`). */
export const TRACKER_SIMULATIONS = [
  /** The first worker crashes once running; the restart succeeds. */
  'worker-crash',
  /** The first worker hangs once running (an overdue result); the restart succeeds. */
  'worker-hang',
  /** Every worker crashes once running: restart, then the main thread. */
  'worker-crash-always',
  /** The worker script can't be loaded: straight to the main thread. */
  'worker-missing',
] as const;

/** A dev failure to rehearse. */
export type TrackerSimulation = (typeof TRACKER_SIMULATIONS)[number];

/**
 * How the worker started after `restarts` restarts should fail, for a rehearsal: crash or hang
 * once running, or nothing. The `-always` form fails every worker, so the main thread takes over.
 */
export function workerFailureFor(
  simulate: TrackerSimulation | null,
  restarts: number,
): 'crash' | 'hang' | null {
  if (simulate === 'worker-crash-always') return 'crash';
  if (restarts > 0) return null;
  if (simulate === 'worker-crash') return 'crash';
  if (simulate === 'worker-hang') return 'hang';
  return null;
}

/** Reads `?simulateTracker=`; null when absent or unknown. */
export function trackerSimulationFromQuery(search: string): TrackerSimulation | null {
  const value = new URLSearchParams(search).get('simulateTracker');
  return TRACKER_SIMULATIONS.find((s) => s === value) ?? null;
}

/** Reads `?detector=main|worker` (forces one, to measure before and after); null otherwise. */
export function detectorFromQuery(search: string): DetectionThread | null {
  const value = new URLSearchParams(search).get('detector');
  return value === 'main' || value === 'worker' ? value : null;
}
