import type { TrackerDelegate } from '../core/types';
import type { HandFrame } from './landmarks';

// The messages between the main thread and the hand worker (T4, D-064). Pure: the types and
// guards are shared by both sides and tested without a worker.
//
// Timing: the main thread stamps each frame with its own clock (the rVFC capture time) and
// the worker echoes it back untouched, so the two threads' different time origins never mix.
// `timestamp` is MediaPipe's strictly increasing VIDEO-mode timestamp, from detectScheduler.

/** Main → worker. */
export type ToWorker =
  | { type: 'init'; assetBase: string; delegates: readonly TrackerDelegate[] }
  | { type: 'frame'; frame: VideoFrame; frameId: number; timestamp: number; captureTime: number }
  /** Dev only (`?simulateTracker=`): make the worker fail, to test restart and fallback. */
  | { type: 'simulate'; failure: 'crash' | 'hang'; hangMs: number };

/** Worker → main. */
export type FromWorker =
  /** Loaded and warmed up (or switched delegate mid-session). */
  | {
      type: 'ready';
      delegate: TrackerDelegate;
      gpuError: string | null;
      loadMs: number;
      warmupMs: number;
    }
  /** Neither delegate could start. */
  | { type: 'failed'; detail: string }
  /** One analysed frame. `hand.t` is the frame's capture time (main-thread clock). */
  | {
      type: 'result';
      frameId: number;
      captureTime: number;
      hand: HandFrame | null;
      detectMs: number;
    }
  /** Detection broke and no delegate is left. */
  | { type: 'error'; frameId: number; detail: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDelegate = (value: unknown): value is TrackerDelegate => value === 'GPU' || value === 'CPU';

/** True when `data` is a well-formed message from the worker. Anything else is ignored. */
export function isFromWorker(data: unknown): data is FromWorker {
  if (!isObject(data)) return false;
  switch (data['type']) {
    case 'ready':
      return (
        isDelegate(data['delegate']) &&
        (data['gpuError'] === null || typeof data['gpuError'] === 'string') &&
        typeof data['loadMs'] === 'number' &&
        typeof data['warmupMs'] === 'number'
      );
    case 'failed':
      return typeof data['detail'] === 'string';
    case 'result':
      return (
        typeof data['frameId'] === 'number' &&
        typeof data['captureTime'] === 'number' &&
        typeof data['detectMs'] === 'number' &&
        (data['hand'] === null || isObject(data['hand']))
      );
    case 'error':
      return typeof data['frameId'] === 'number' && typeof data['detail'] === 'string';
    default:
      return false;
  }
}

/** True when `data` is a well-formed message from the main thread. */
export function isToWorker(data: unknown): data is ToWorker {
  if (!isObject(data)) return false;
  switch (data['type']) {
    case 'init':
      return (
        typeof data['assetBase'] === 'string' &&
        Array.isArray(data['delegates']) &&
        data['delegates'].every(isDelegate)
      );
    case 'frame':
      return (
        isObject(data['frame']) &&
        typeof data['frameId'] === 'number' &&
        typeof data['timestamp'] === 'number' &&
        typeof data['captureTime'] === 'number'
      );
    case 'simulate':
      return (
        (data['failure'] === 'crash' || data['failure'] === 'hang') &&
        typeof data['hangMs'] === 'number'
      );
    default:
      return false;
  }
}
