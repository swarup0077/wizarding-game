import type { TrackerDelegate } from '../../core/types';
import { errorText } from '../delegateFallback';
import { createDetectScheduler } from '../detectScheduler';
import { type LandmarkerHost, type LandmarkerResult, startLandmarker } from '../landmarkerFactory';
import { toHandFrame } from '../landmarks';
import type { BackendEvents, BackendReady, DetectionBackend } from './backend';

// Detection on the main thread: the fallback when the hand worker can't run (T4, D-064).
// Each detection blocks the main thread (19–31 ms on Iris Xe), so frames run late while a
// hand is tracked; that is why the worker comes first.

/** What the main-thread backend needs. */
export interface MainThreadBackendOptions {
  video: HTMLVideoElement;
  assetBase: string;
  delegates: readonly TrackerDelegate[];
  events: BackendEvents;
}

const readyOf = (host: LandmarkerHost): BackendReady => {
  const { delegate, gpuError, loadMs, warmupMs } = host.active();
  return { delegate, gpuError, loadMs, warmupMs };
};

/** The <video>'s current picture (the frame just analysed), or null if it can't be read. */
function pictureOf(video: HTMLVideoElement, captureTime: number): VideoFrame | null {
  try {
    return new VideoFrame(video, { timestamp: Math.round(captureTime * 1000) });
  } catch {
    return null;
  }
}

/** Creates the main-thread backend. Nothing loads until `start()`. */
export function createMainThreadBackend(options: MainThreadBackendOptions): DetectionBackend {
  const { video, assetBase, delegates, events } = options;
  const scheduler = createDetectScheduler();
  let host: LandmarkerHost | null = null;
  let disposed = false;

  /** The active delegate failed: start the next one. The scheduler stays busy until done. */
  async function fallBack(error: unknown): Promise<void> {
    const h = host;
    try {
      const next = h ? await h.fallBack(error) : null;
      if (disposed) return;
      if (h && next) events.onDelegate(readyOf(h));
      else events.onFailure(errorText(error));
    } catch (second) {
      if (!disposed) events.onFailure(errorText(second));
    } finally {
      scheduler.finish();
    }
  }

  return {
    thread: 'main',

    async start() {
      host = await startLandmarker(assetBase, delegates);
      if (disposed) {
        host.close();
        throw new Error('Stopped while starting.');
      }
      return readyOf(host);
    },

    frame(frameId, captureTime) {
      if (!host || disposed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const timestamp = scheduler.begin(frameId, captureTime);
      if (timestamp === null) return;
      let result: LandmarkerResult;
      const start = performance.now();
      try {
        result = host.active().landmarker.detectForVideo(video, timestamp);
      } catch (error) {
        void fallBack(error); // finishes the scheduler when done
        return;
      }
      const detectMs = performance.now() - start;
      scheduler.finish();
      events.onResult(
        toHandFrame(result, captureTime),
        captureTime,
        detectMs,
        events.wantsFrame() ? pictureOf(video, captureTime) : null,
      );
    },

    dispose() {
      disposed = true;
      host?.close();
      host = null;
    },
  };
}
