import type { TrackerDelegate } from '../../core/types';
import { errorText } from '../delegateFallback';
import { type LandmarkerHost, startLandmarker } from '../landmarkerFactory';
import { toHandFrame } from '../landmarks';
import { type FromWorker, isToWorker, type ToWorker } from '../workerProtocol';

// The hand worker (T4, D-064): MediaPipe hand detection off the main thread, so a detection
// (19–31 ms on Iris Xe) or the first-use GPU warm-up (~3 s in a fresh profile) never delays
// a rendered frame. A classic worker (MediaPipe loads its wasm glue with importScripts),
// built on its own by vite/handWorkerPlugin.ts.
//
// The main thread sends one frame at a time and waits for its result. Every frame is closed
// here, in a `finally`, whatever happens: an unclosed frame holds a camera buffer, and when
// the camera's buffer pool runs out the picture freezes.

declare const self: DedicatedWorkerGlobalScope;

let host: LandmarkerHost | null = null;
/** True while the landmarker is being replaced: frames are skipped (the main thread waits). */
let switching = false;

const post = (message: FromWorker): void => self.postMessage(message);

self.onmessage = (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isToWorker(message)) {
    // Never keep a frame we can't use.
    const frame = (message as { frame?: unknown } | null)?.frame;
    if (frame instanceof VideoFrame) frame.close();
    return;
  }
  if (message.type === 'init') void init(message.assetBase, message.delegates);
  else if (message.type === 'frame') detect(message);
  else simulate(message.failure, message.hangMs);
};

async function init(assetBase: string, delegates: readonly TrackerDelegate[]): Promise<void> {
  try {
    host = await startLandmarker(assetBase, delegates);
    post({ type: 'ready', ...readyInfo(host) });
  } catch (error) {
    post({ type: 'failed', detail: errorText(error) });
  }
}

function readyInfo(h: LandmarkerHost): Omit<Extract<FromWorker, { type: 'ready' }>, 'type'> {
  const { delegate, gpuError, loadMs, warmupMs } = h.active();
  return { delegate, gpuError, loadMs, warmupMs };
}

function detect(message: Extract<ToWorker, { type: 'frame' }>): void {
  const { frame, frameId, timestamp, captureTime } = message;
  try {
    if (!host || switching) throw new Error('The landmarker is not ready.');
    const start = performance.now();
    const result = host.active().landmarker.detectForVideo(frame, timestamp);
    const detectMs = performance.now() - start;
    post({
      type: 'result',
      frameId,
      captureTime,
      hand: toHandFrame(result, captureTime),
      detectMs,
    });
  } catch (error) {
    if (host && !switching) void fallBack(host, error, frameId);
    else post({ type: 'error', frameId, detail: errorText(error) });
  } finally {
    frame.close();
  }
}

/** The active delegate failed mid-session: switch to the next one inside the worker. */
async function fallBack(h: LandmarkerHost, error: unknown, frameId: number): Promise<void> {
  switching = true;
  try {
    const next = await h.fallBack(error);
    if (next) post({ type: 'ready', ...readyInfo(h) });
    else post({ type: 'error', frameId, detail: errorText(error) });
  } catch (second) {
    post({ type: 'error', frameId, detail: errorText(second) });
  } finally {
    switching = false;
  }
}

/** Dev only: fail on purpose, to exercise the main thread's restart and fallback. */
function simulate(failure: 'crash' | 'hang', hangMs: number): void {
  if (failure === 'crash') throw new Error('Simulated hand worker crash (?simulateTracker).');
  const until = performance.now() + hangMs;
  while (performance.now() < until) {
    // Busy on purpose: the next result is overdue.
  }
}
