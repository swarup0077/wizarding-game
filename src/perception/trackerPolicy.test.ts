import { describe, expect, it } from 'vitest';
import {
  detectorFromQuery,
  stepAfterFailure,
  trackerSimulationFromQuery,
  workerFailureFor,
} from './trackerPolicy';

describe('stepAfterFailure', () => {
  it('restarts a running worker once, then falls back to the main thread', () => {
    expect(stepAfterFailure('worker', 0, 1, true)).toBe('restart-worker');
    expect(stepAfterFailure('worker', 1, 1, true)).toBe('main-thread');
  });

  it('a worker that never started goes straight to the main thread', () => {
    expect(stepAfterFailure('worker', 0, 1, false)).toBe('main-thread');
  });

  it('with no restarts allowed, a failed worker falls back at once', () => {
    expect(stepAfterFailure('worker', 0, 0, true)).toBe('main-thread');
  });

  it('when the main thread fails too, it gives up', () => {
    expect(stepAfterFailure('main', 0, 1, true)).toBe('give-up');
    expect(stepAfterFailure('main', 0, 1, false)).toBe('give-up');
  });
});

describe('workerFailureFor', () => {
  it('fails only the first worker, so the restart succeeds', () => {
    expect(workerFailureFor('worker-crash', 0)).toBe('crash');
    expect(workerFailureFor('worker-crash', 1)).toBeNull();
    expect(workerFailureFor('worker-hang', 0)).toBe('hang');
    expect(workerFailureFor('worker-hang', 1)).toBeNull();
  });

  it('the -always form fails every worker; no simulation fails none', () => {
    expect(workerFailureFor('worker-crash-always', 0)).toBe('crash');
    expect(workerFailureFor('worker-crash-always', 1)).toBe('crash');
    expect(workerFailureFor(null, 0)).toBeNull();
    expect(workerFailureFor('worker-missing', 0)).toBeNull();
  });
});

describe('query overrides', () => {
  it('reads ?simulateTracker= and ignores unknown values', () => {
    expect(trackerSimulationFromQuery('?simulateTracker=worker-hang')).toBe('worker-hang');
    expect(trackerSimulationFromQuery('?simulateTracker=meteor')).toBeNull();
    expect(trackerSimulationFromQuery('')).toBeNull();
  });

  it('reads ?detector=main|worker', () => {
    expect(detectorFromQuery('?detector=main')).toBe('main');
    expect(detectorFromQuery('?a=1&detector=worker')).toBe('worker');
    expect(detectorFromQuery('?detector=gpu')).toBeNull();
  });
});
