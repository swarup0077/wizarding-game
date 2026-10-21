import type { TrackerDelegate } from '../../core/types';
import type { HandFrame } from '../landmarks';

// Where hand detection runs (T4, D-064): in the hand worker, or on the main thread as the
// fallback. handTracker.ts drives either through this one interface and never knows which.

/** Which thread runs detection. */
export type DetectionThread = 'worker' | 'main';

/** A backend that has started (loaded, chosen a delegate, warmed up). */
export interface BackendReady {
  delegate: TrackerDelegate;
  gpuError: string | null;
  loadMs: number;
  warmupMs: number;
}

/** What a backend reports while running. */
export interface BackendEvents {
  /**
   * One analysed frame. `captureTime` is the frame's (main-thread clock), echoed back.
   * `frame` is the picture that was analysed (when `wantsFrame()` said so): the receiver now
   * owns it and must close it.
   */
  onResult(
    hand: HandFrame | null,
    captureTime: number,
    detectMs: number,
    frame: VideoFrame | null,
  ): void;
  /** Whether results should carry their picture (the synchronized preview, T4 part 3). */
  wantsFrame(): boolean;
  /** The delegate changed mid-session (the GPU failed, the CPU took over). */
  onDelegate(ready: BackendReady): void;
  /** The backend can't continue (crash, overdue result, no delegate left). */
  onFailure(detail: string): void;
}

/** A detection backend. */
export interface DetectionBackend {
  readonly thread: DetectionThread;
  /** Loads and warms up. Rejects if it can't start. */
  start(): Promise<BackendReady>;
  /** A new video frame, with its capture time. Skipped while a detection is in flight. */
  frame(frameId: number, captureTime: number): void;
  /** Stops and frees everything, including any frame in flight. */
  dispose(): void;
}
