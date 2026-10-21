import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { DEBUG, TRACKING } from '../config/tuning';
import type { Clock } from '../core/clock';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import { createFpsMeter } from '../core/fpsMeter';
import { createRollingStats } from '../core/rollingStats';
import type { TrackerDelegate, TrackerFailureKind } from '../core/types';
import { createWithFallback, errorText, nextDelegate } from './delegateFallback';
import { createDetectScheduler } from './detectScheduler';
import { type HandFrame, toHandFrame } from './landmarks';
import { createSlowTrackingWatch } from './slowTrackingWatch';
import { watchVideoFrames } from './videoFrameLoop';

// MediaPipe HandLandmarker (FR-2): the only file that touches MediaPipe (lint enforces it).
// Thin on purpose: when to detect, which delegate, how slow is too slow and how results
// become plain data are all pure modules next to this one. If detection ever moves to a
// Web Worker, this file is what changes (docs/LATER.md).
//
// Lifecycle: loading starts when the camera is asked for (`camera:status` starting), so the
// download overlaps the permission prompt and mouse-only players never fetch it. Detection
// runs while the camera is live, once per new video frame, on the shared <video> element.

/** What the tracker needs. */
export interface HandTrackerOptions {
  bus: EventBus<EventMap>;
  /** The camera's <video> (the preview shows the same element). */
  video: HTMLVideoElement;
  clock: Clock;
  /** Where `public/` is served from: Vite's BASE_URL. */
  assetBase: string;
  /** Delegates to try, in order (normally GPU then CPU; `?delegate=` forces one). */
  delegates: readonly TrackerDelegate[];
}

/** Live numbers for the debug overlay and the fps reporter. */
export interface TrackerStats {
  state: 'idle' | 'loading' | 'ready' | 'failed';
  delegate: TrackerDelegate | null;
  /** Why the GPU isn't in use, when it isn't. */
  gpuError: string | null;
  /** Why tracking failed, when it did. */
  failure: string | null;
  /** Detections completed per second. */
  trackingFps: number;
  /** New video frames per second (the camera's real rate). */
  videoFps: number;
  /** Main-thread time per detection, after warm-up. */
  detectMeanMs: number;
  detectP95Ms: number;
  /** The first detection (shader compile, cold caches), reported apart. */
  firstDetectMs: number | null;
  /** Whether the last analysed frame had a hand. */
  handSeen: boolean;
}

/** The running tracker. */
export interface HandTracker {
  /** Every analysed frame: the hand, or null when none was found (T5 builds the wand from this). */
  onFrame(listener: (frame: HandFrame | null) => void): void;
  stats: () => TrackerStats;
}

type CreateLandmarker = (delegate: TrackerDelegate) => Promise<HandLandmarker>;

/** Creates the tracker. It waits for the camera before loading anything. */
export function createHandTracker(options: HandTrackerOptions): HandTracker {
  const { bus, video, clock, assetBase, delegates } = options;
  const listeners: ((frame: HandFrame | null) => void)[] = [];
  const scheduler = createDetectScheduler();
  const detectMs = createRollingStats(TRACKING.detectStatsWindow);
  const trackingMeter = createFpsMeter(DEBUG.fpsWindowMs);
  const videoMeter = createFpsMeter(DEBUG.fpsWindowMs);
  const slowWatch = createSlowTrackingWatch({
    thresholdFps: TRACKING.lowFpsThreshold,
    enterMs: TRACKING.lowFpsWindowMs,
    recoverMs: TRACKING.lowFpsRecoverMs,
    graceMs: TRACKING.lowFpsStartGraceMs,
  });

  let state: TrackerStats['state'] = 'idle';
  let landmarker: HandLandmarker | null = null;
  let createLandmarker: CreateLandmarker | null = null;
  let delegate: TrackerDelegate | null = null;
  let gpuError: string | null = null;
  let failure: string | null = null;
  let loading: Promise<void> | null = null;
  let cameraLive = false;
  let stopFrames: (() => void) | null = null;
  let slowTimer: ReturnType<typeof setInterval> | null = null;
  let detections = 0;
  let firstDetectMs: number | null = null;
  let handSeen = false;

  function ready(): void {
    state = 'ready';
    const status: EventMap['tracker:status'] = { state, t: clock.now() };
    if (delegate) status.delegate = delegate;
    if (gpuError) status.gpuError = gpuError;
    bus.emit('tracker:status', status);
    startDetecting();
  }

  function fail(kind: TrackerFailureKind, detail: string): void {
    state = 'failed';
    failure = detail;
    stopDetecting();
    bus.emit('tracker:status', { state, failure: kind, detail, t: clock.now() });
  }

  async function load(): Promise<void> {
    state = 'loading';
    bus.emit('tracker:status', { state, t: clock.now() });
    if (typeof WebAssembly === 'undefined') {
      fail('unsupported', 'This browser has no WebAssembly.');
      return;
    }
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(`${assetBase}mediapipe/wasm`);
      createLandmarker = (d) =>
        vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${assetBase}models/hand_landmarker.task`, delegate: d },
          runningMode: 'VIDEO',
          numHands: TRACKING.numHands,
        });
      const choice = await createWithFallback(delegates, createLandmarker);
      landmarker = choice.value;
      delegate = choice.delegate;
      gpuError = choice.failed.find((f) => f.delegate === 'GPU')?.error ?? null;
      ready();
    } catch (error) {
      fail('load-failed', errorText(error));
    }
  }

  /** The active delegate failed mid-session: close it and start the next one, once. */
  async function fallBack(error: unknown): Promise<void> {
    const next = delegate ? nextDelegate(delegates, delegate) : null;
    landmarker?.close();
    landmarker = null;
    if (!next || !createLandmarker) {
      scheduler.finish();
      fail('load-failed', errorText(error));
      return;
    }
    if (delegate === 'GPU') gpuError = errorText(error);
    try {
      landmarker = await createLandmarker(next);
      delegate = next;
      // Start the numbers over, so the overlay never mixes two delegates' timings.
      detectMs.clear();
      detections = 0;
      ready();
    } catch (second) {
      fail('load-failed', errorText(second));
    } finally {
      // The scheduler stayed busy while the landmarker was replaced, so no frame tried to use it.
      scheduler.finish();
    }
  }

  function onVideoFrame(frameId: number): void {
    const now = clock.now();
    videoMeter.tick(now);
    if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const timestamp = scheduler.begin(frameId, now);
    if (timestamp === null) return;
    let result: ReturnType<HandLandmarker['detectForVideo']>;
    try {
      result = landmarker.detectForVideo(video, timestamp);
    } catch (error) {
      void fallBack(error); // finishes the scheduler when done
      return;
    }
    const end = clock.now();
    scheduler.finish();
    recordDetection(end - now, end);
    const frame = toHandFrame(result, timestamp);
    handSeen = frame !== null;
    bus.emit('hand:landmarks', { points: frame?.points ?? [], t: timestamp });
    for (const listener of listeners) listener(frame);
  }

  function recordDetection(ms: number, end: number): void {
    detections++;
    trackingMeter.tick(end);
    if (detections === 1) firstDetectMs = ms;
    if (detections > TRACKING.warmupDetections) detectMs.add(ms);
  }

  function checkSlow(): void {
    const now = clock.now();
    const fps = trackingMeter.read(now);
    const change = slowWatch.update(fps, now);
    if (change) bus.emit('tracker:slow', { slow: change === 'slow', fps, t: now });
  }

  function startDetecting(): void {
    if (!cameraLive || !landmarker || stopFrames) return;
    scheduler.resetFrames();
    stopFrames = watchVideoFrames(video, onVideoFrame);
    if (!document.hidden) slowWatch.restart(clock.now());
    slowTimer = setInterval(checkSlow, TRACKING.lowFpsCheckMs);
  }

  function stopDetecting(): void {
    stopFrames?.();
    stopFrames = null;
    if (slowTimer) clearInterval(slowTimer);
    slowTimer = null;
    slowWatch.pause();
    handSeen = false;
  }

  bus.on('camera:status', ({ state: camera }) => {
    if (camera === 'starting' || camera === 'live') loading ??= load();
    cameraLive = camera === 'live';
    if (cameraLive) startDetecting();
    else stopDetecting();
  });

  // A hidden tab gets no video frames, so fps falls for reasons a tip can't fix.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) slowWatch.pause();
    else if (stopFrames) slowWatch.restart(clock.now());
  });

  return {
    onFrame(listener) {
      listeners.push(listener);
    },
    stats() {
      const now = clock.now();
      return {
        state,
        delegate,
        gpuError,
        failure,
        trackingFps: stopFrames ? trackingMeter.read(now) : 0,
        videoFps: stopFrames ? videoMeter.read(now) : 0,
        detectMeanMs: detectMs.mean(),
        detectP95Ms: detectMs.p95(),
        firstDetectMs,
        handSeen,
      };
    },
  };
}
