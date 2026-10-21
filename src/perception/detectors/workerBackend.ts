import { TRACKING } from '../../config/tuning';
import type { TrackerDelegate } from '../../core/types';
import { errorText } from '../delegateFallback';
import { createDetectScheduler } from '../detectScheduler';
import { isFromWorker, type FromWorker, type ToWorker } from '../workerProtocol';
import type { BackendEvents, BackendReady, DetectionBackend } from './backend';

// The main thread's side of the hand worker (T4, D-064). Per camera frame it costs a
// `new VideoFrame(video)` (0.1 ms, no pixel copy) and a postMessage; detection runs in the
// worker.
//
// - One frame in flight at most: while the worker is busy, new camera frames are skipped
//   (no VideoFrame is even made), so nothing queues and results are never stale. The newest
//   skipped frame is remembered and sent the moment the result arrives, so detection keeps
//   pace with the camera instead of waiting for its next frame (measured in T4: 29.4 results
//   per second from a 30 fps camera with a 25 ms detection, against 24.9–28.4 without).
// - The frame is transferred to the worker, which closes it after detecting. The main thread
//   keeps a second handle on the same buffer (a clone: no copy) until the result arrives, so
//   it can always release the camera buffer itself, even if the worker dies holding its copy.
// - Each frame carries its capture time (main-thread clock), echoed back with the result.

/** What the worker backend needs. */
export interface WorkerBackendOptions {
  /** The built worker script (vite/handWorkerPlugin.ts). */
  url: string;
  video: HTMLVideoElement;
  assetBase: string;
  delegates: readonly TrackerDelegate[];
  events: BackendEvents;
  /** Dev: make this worker fail on purpose once running (`?simulateTracker=`). */
  simulate?: 'crash' | 'hang' | null;
}

interface InFlight {
  frameId: number;
  /** Our own handle on the frame, closed when the result arrives or the worker goes. */
  keep: VideoFrame;
  overdue: ReturnType<typeof setTimeout>;
}

/** Creates the worker backend. Nothing starts until `start()`. */
export function createWorkerBackend(options: WorkerBackendOptions): DetectionBackend {
  const { url, video, assetBase, delegates, events } = options;
  const scheduler = createDetectScheduler();
  let worker: Worker | null = null;
  let inFlight: InFlight | null = null;
  /** The newest frame skipped while the worker was busy. */
  let skipped: { frameId: number; captureTime: number } | null = null;
  let running = false;
  let disposed = false;
  let settle: { resolve(ready: BackendReady): void; reject(error: Error): void } | null = null;

  const send = (message: ToWorker, transfer: Transferable[] = []): void =>
    worker?.postMessage(message, transfer);

  /** Ends the detection in flight and returns our handle on its frame (null if none). */
  function takeInFlight(): VideoFrame | null {
    if (!inFlight) return null;
    clearTimeout(inFlight.overdue);
    const { keep } = inFlight;
    inFlight = null;
    scheduler.finish();
    return keep;
  }

  /** Closes our handle on the frame in flight and lets the next frame through. */
  function release(): void {
    takeInFlight()?.close();
  }

  function fail(detail: string): void {
    release();
    if (settle) {
      settle.reject(new Error(detail));
      settle = null;
    } else if (running && !disposed) {
      running = false;
      events.onFailure(detail);
    }
  }

  function onMessage(message: FromWorker): void {
    if (message.type === 'ready') {
      const { delegate, gpuError, loadMs, warmupMs } = message;
      const ready = { delegate, gpuError, loadMs, warmupMs };
      if (settle) {
        settle.resolve(ready);
        settle = null;
        running = true;
        armSimulation();
      } else {
        release(); // the frame that broke the old delegate gets no result
        events.onDelegate(ready);
      }
    } else if (message.type === 'failed') fail(message.detail);
    else if (message.type === 'error') fail(message.detail);
    else if (inFlight?.frameId === message.frameId) {
      // Our handle on the analysed frame goes up with the result (the synchronized preview
      // draws and closes it), or is closed here when nobody wants it.
      const keep = takeInFlight();
      const frame = events.wantsFrame() ? keep : (keep?.close(), null);
      events.onResult(message.hand, message.captureTime, message.detectMs, frame);
      // Catch up: the <video> still shows the newest skipped frame, so send it now.
      const next = skipped;
      skipped = null;
      if (next) sendFrame(next.frameId, next.captureTime);
    }
  }

  /** Sends the <video>'s current frame to the worker, if it is new and the worker is free. */
  function sendFrame(frameId: number, captureTime: number): void {
    if (!running || !worker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const timestamp = scheduler.begin(frameId, captureTime);
    if (timestamp === null) return;
    let frame: VideoFrame;
    try {
      frame = new VideoFrame(video, { timestamp: Math.round(captureTime * 1000) });
    } catch {
      scheduler.finish(); // no picture yet (or the stream just changed): skip
      return;
    }
    const keep = frame.clone();
    const overdue = setTimeout(
      () => fail(`A hand detection took longer than ${TRACKING.workerResultTimeoutMs} ms.`),
      TRACKING.workerResultTimeoutMs,
    );
    inFlight = { frameId, keep, overdue };
    try {
      send({ type: 'frame', frame, frameId, timestamp, captureTime }, [frame]);
    } catch (error) {
      frame.close();
      fail(`A frame couldn't be sent to the hand worker: ${errorText(error)}`);
    }
  }

  function armSimulation(): void {
    const failure = options.simulate;
    if (!failure) return;
    const hangMs = TRACKING.workerResultTimeoutMs * 2;
    setTimeout(() => send({ type: 'simulate', failure, hangMs }), TRACKING.simulateFailureAfterMs);
  }

  return {
    thread: 'worker',

    start() {
      return new Promise<BackendReady>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            fail(`The hand worker didn't start within ${TRACKING.workerReadyTimeoutMs / 1000} s.`),
          TRACKING.workerReadyTimeoutMs,
        );
        settle = {
          resolve: (ready) => {
            clearTimeout(timer);
            resolve(ready);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
        try {
          worker = new Worker(url); // classic: MediaPipe needs importScripts
        } catch (error) {
          fail(`The hand worker couldn't be created: ${errorText(error)}`);
          return;
        }
        worker.onmessage = (event: MessageEvent<unknown>) => {
          if (isFromWorker(event.data)) onMessage(event.data);
        };
        worker.onerror = (event: ErrorEvent) => {
          event.preventDefault(); // handled here: not an uncaught page error
          fail(event.message || "The hand worker's script failed to load.");
        };
        worker.onmessageerror = () => fail("A hand worker message couldn't be read.");
        send({ type: 'init', assetBase, delegates });
      });
    },

    frame(frameId, captureTime) {
      if (!running) return;
      if (scheduler.busy()) {
        skipped = { frameId, captureTime }; // busy: drop it, but remember the newest
        return;
      }
      sendFrame(frameId, captureTime);
    },

    dispose() {
      disposed = true;
      running = false;
      skipped = null;
      release();
      worker?.terminate();
      worker = null;
      settle?.reject(new Error('Stopped while starting.'));
      settle = null;
    },
  };
}
