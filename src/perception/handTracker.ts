import { TRACKING } from '../config/tuning';
import type { Clock } from '../core/clock';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { TrackerDelegate, TrackerFailureKind, Vec2 } from '../core/types';
import { type DelegateOrders, errorText } from './delegateFallback';
import type {
  BackendEvents,
  BackendReady,
  DetectionBackend,
  DetectionThread,
} from './detectors/backend';
import { createMainThreadBackend } from './detectors/mainThreadBackend';
import { createWorkerBackend } from './detectors/workerBackend';
import type { HandFrame } from './landmarks';
import { createSlowTrackingWatch } from './slowTrackingWatch';
import { createTrackerMetrics, type MetricsSnapshot } from './trackerMetrics';
import { stepAfterFailure, type TrackerSimulation, workerFailureFor } from './trackerPolicy';
import { watchVideoFrames } from './videoFrameLoop';

// Hand tracking (FR-2): the one module other layers know. Detection runs in the hand worker
// (T4, D-064), or on the main thread if the worker can't; this file only chooses and
// supervises, and turns results into `hand:landmarks` and the tracker events.
//
// Lifecycle: loading starts when the camera is asked for (`camera:status` starting), so the
// download overlaps the permission prompt and mouse-only players never fetch it. Frames are
// watched while the camera is live and sent to the backend once it is ready.
// Failure order: worker → the worker restarted once → main thread → give up (trackerPolicy).

/** What the tracker needs. */
export interface HandTrackerOptions {
  bus: EventBus<EventMap>;
  /** The camera's <video> (the preview shows the same element). */
  video: HTMLVideoElement;
  clock: Clock;
  /** Where `public/` is served from: Vite's BASE_URL. */
  assetBase: string;
  /** Delegates to try per thread, in order (worker CPU first, main thread GPU first; D-068). */
  delegates: DelegateOrders;
  /** The built hand worker; null runs detection on the main thread (`?detector=main`). */
  workerUrl: string | null;
  /** Dev: a failure to rehearse (`?simulateTracker=`). */
  simulate: TrackerSimulation | null;
}

/** Live numbers for the debug overlay and the fps reporter. */
export interface TrackerStats extends MetricsSnapshot {
  state: 'idle' | 'loading' | 'ready' | 'failed';
  thread: DetectionThread | null;
  delegate: TrackerDelegate | null;
  /** Why the GPU isn't in use, when it isn't. */
  gpuError: string | null;
  /** Why detection left the worker (or what the worker recovered from). */
  workerError: string | null;
  workerRestarts: number;
  /** Why tracking failed, when it did. */
  failure: string | null;
  /** Starting the active backend: loading, and the warm-up detection. */
  loadMs: number | null;
  warmupMs: number | null;
  /** When the tracker last started loading, and last became ready (clock ms; for measuring start-up). */
  loadingAt: number | null;
  readyAt: number | null;
  /** Whether the last analysed frame had a hand. */
  handSeen: boolean;
}

/**
 * Receives each analysed picture with its landmarks, for the synchronized preview. It owns the
 * frame and must close it (also when it doesn't draw it).
 */
export type PreviewSink = (frame: VideoFrame, points: readonly Vec2[], captureTime: number) => void;

/** The running tracker. */
export interface HandTracker {
  /** Every analysed frame: the hand, or null when none was found (T5 builds the wand from this). */
  onFrame(listener: (frame: HandFrame | null) => void): void;
  /** Sends every analysed picture to `sink` (one sink; the webcam preview). */
  setPreviewSink(sink: PreviewSink | null): void;
  stats: () => TrackerStats;
}

/** Creates the tracker. It waits for the camera before loading anything. */
export function createHandTracker(options: HandTrackerOptions): HandTracker {
  const { bus, video, clock, assetBase, delegates, workerUrl, simulate } = options;
  const listeners: ((frame: HandFrame | null) => void)[] = [];
  let previewSink: PreviewSink | null = null;
  const metrics = createTrackerMetrics();
  const slowWatch = createSlowTrackingWatch({
    thresholdFps: TRACKING.lowFpsThreshold,
    enterMs: TRACKING.lowFpsWindowMs,
    recoverMs: TRACKING.lowFpsRecoverMs,
    graceMs: TRACKING.lowFpsStartGraceMs,
  });

  let state: TrackerStats['state'] = 'idle';
  let backend: DetectionBackend | null = null;
  /** Events from a backend that has been replaced are ignored. */
  let generation = 0;
  let ready: BackendReady | null = null;
  let workerError: string | null = null;
  let restarts = 0;
  let failure: string | null = null;
  let loading: Promise<void> | null = null;
  let cameraLive = false;
  let stopFrames: (() => void) | null = null;
  let slowTimer: ReturnType<typeof setInterval> | null = null;
  let handSeen = false;
  let loadingAt: number | null = null;
  let readyAt: number | null = null;

  const tracking = (): boolean => cameraLive && state === 'ready';

  function setReady(next: BackendReady): void {
    ready = next;
    state = 'ready';
    readyAt = clock.now();
    metrics.reset();
    const status: EventMap['tracker:status'] = { state, delegate: next.delegate, t: clock.now() };
    if (next.gpuError) status.gpuError = next.gpuError;
    bus.emit('tracker:status', status);
    if (tracking() && !document.hidden) slowWatch.restart(clock.now());
  }

  function fail(kind: TrackerFailureKind, detail: string): void {
    state = 'failed';
    failure = detail;
    slowWatch.pause();
    bus.emit('tracker:status', { state, failure: kind, detail, t: clock.now() });
  }

  function makeBackend(thread: DetectionThread): DetectionBackend {
    const mine = ++generation;
    const events: BackendEvents = {
      onResult: (hand, captureTime, ms, frame) => {
        if (mine === generation) onResult(hand, captureTime, ms, frame);
        else frame?.close(); // a replaced backend's late result
      },
      wantsFrame: () => previewSink !== null,
      onDelegate: (next) => {
        if (mine === generation) setReady(next);
      },
      onFailure: (detail) => {
        if (mine === generation) void recover(thread, detail, true);
      },
    };
    if (thread === 'main' || !workerUrl)
      return createMainThreadBackend({ video, assetBase, delegates: delegates.main, events });
    return createWorkerBackend({
      url: simulate === 'worker-missing' ? `${workerUrl}.missing` : workerUrl,
      video,
      assetBase,
      delegates: delegates.worker,
      events,
      simulate: workerFailureFor(simulate, restarts),
    });
  }

  async function startOn(thread: DetectionThread): Promise<void> {
    state = 'loading';
    ready = null;
    loadingAt = clock.now();
    slowWatch.pause();
    bus.emit('tracker:status', { state, t: clock.now() });
    const next = makeBackend(thread);
    backend = next;
    try {
      setReady(await next.start());
    } catch (error) {
      if (backend === next) await recover(thread, errorText(error), false);
    }
  }

  /** The backend on `thread` failed, while running (`midSession`) or while starting. */
  async function recover(
    thread: DetectionThread,
    detail: string,
    midSession: boolean,
  ): Promise<void> {
    backend?.dispose();
    backend = null;
    generation++;
    if (thread === 'worker') workerError = detail;
    const step = stepAfterFailure(thread, restarts, TRACKING.workerRestarts, midSession);
    if (step === 'restart-worker') {
      restarts++;
      await startOn('worker');
    } else if (step === 'main-thread') await startOn('main');
    else fail(typeof WebAssembly === 'undefined' ? 'unsupported' : 'load-failed', detail);
  }

  function onResult(
    hand: HandFrame | null,
    captureTime: number,
    ms: number,
    frame: VideoFrame | null,
  ): void {
    metrics.result(clock.now(), captureTime, ms);
    handSeen = hand !== null;
    const points = hand?.points ?? [];
    bus.emit('hand:landmarks', { points, t: captureTime });
    for (const listener of listeners) listener(hand);
    if (frame) {
      if (previewSink) previewSink(frame, points, captureTime);
      else frame.close();
    }
  }

  function onVideoFrame(frameId: number, captureTime: number): void {
    metrics.videoFrame(clock.now(), captureTime);
    if (state === 'ready') backend?.frame(frameId, captureTime);
  }

  function checkSlow(): void {
    if (!tracking()) return;
    const now = clock.now();
    const fps = metrics.trackingFps(now);
    const change = slowWatch.update(fps, now);
    if (change) bus.emit('tracker:slow', { slow: change === 'slow', fps, t: now });
  }

  function watchFrames(on: boolean): void {
    if (on && !stopFrames) {
      stopFrames = watchVideoFrames(video, onVideoFrame);
      slowTimer = setInterval(checkSlow, TRACKING.lowFpsCheckMs);
      if (tracking() && !document.hidden) slowWatch.restart(clock.now());
    } else if (!on && stopFrames) {
      stopFrames();
      stopFrames = null;
      if (slowTimer) clearInterval(slowTimer);
      slowTimer = null;
      slowWatch.pause();
      handSeen = false;
    }
  }

  bus.on('camera:status', ({ state: camera }) => {
    if (camera === 'starting' || camera === 'live')
      loading ??= startOn(workerUrl ? 'worker' : 'main');
    cameraLive = camera === 'live';
    watchFrames(cameraLive);
  });

  // A hidden tab gets no video frames, so fps falls for reasons a tip can't fix.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) slowWatch.pause();
    else if (tracking()) slowWatch.restart(clock.now());
  });

  return {
    onFrame(listener) {
      listeners.push(listener);
    },
    setPreviewSink(sink) {
      previewSink = sink;
    },
    stats() {
      const now = clock.now();
      const numbers = metrics.read(now);
      return {
        ...numbers,
        // A stopped camera reads 0, not the last rate the meters saw.
        trackingFps: stopFrames ? numbers.trackingFps : 0,
        videoFps: stopFrames ? numbers.videoFps : 0,
        state,
        thread: backend?.thread ?? null,
        delegate: ready?.delegate ?? null,
        gpuError: ready?.gpuError ?? null,
        workerError,
        workerRestarts: restarts,
        failure,
        loadMs: ready?.loadMs ?? null,
        warmupMs: ready?.warmupMs ?? null,
        loadingAt,
        readyAt,
        handSeen,
      };
    },
  };
}
