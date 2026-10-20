import { CAMERA } from '../config/tuning';
import type { CameraActual } from '../core/types';
import {
  type CameraErrorInfo,
  type CameraPermission,
  errorInfo,
  shouldRetryWithoutConstraints,
} from './cameraErrors';

// The webcam (FR-1): a thin wrapper over getUserMedia and the Permissions API. Every
// decision (what a failure means, when to retry, when to start by itself) lives in the pure
// modules cameraErrors.ts and cameraFlow.ts; this file only talks to the browser.
//
// There is one <video> element for the whole session. The preview shows it now, and the hand
// tracker (T4) will read frames from the same element, so the stream is decoded once.

/** A running camera stream. */
export interface CameraSession {
  actual: CameraActual;
  /** True when the ideal constraints were refused and the camera's defaults are used. */
  retriedUnconstrained: boolean;
  /** Puts the stream on the shared <video> element and plays it. */
  show(): void;
  /** Calls `listener` once if the camera stops by itself (unplugged, taken, revoked). */
  onEnded(listener: () => void): void;
  /** Stops every track (the camera light goes off) and clears the video if it is ours. */
  stop(): void;
}

/** The result of asking for the camera. Never a rejected promise. */
export type CameraStart =
  { ok: true; session: CameraSession } | { ok: false; error: CameraErrorInfo };

/** What the camera controller needs from the browser (a fake in tests). */
export interface Camera {
  /** `window.isSecureContext`. */
  secure(): boolean;
  /** Whether `navigator.mediaDevices.getUserMedia` exists. */
  hasMediaDevices(): boolean;
  start(): Promise<CameraStart>;
  permission(): Promise<CameraPermission>;
  /** Calls `listener` whenever the camera permission changes. */
  watchPermission(listener: (permission: CameraPermission) => void): void;
}

/** The browser camera, plus the shared <video> element the preview and tracker use. */
export interface BrowserCamera extends Camera {
  readonly video: HTMLVideoElement;
}

const IDEAL: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: CAMERA.idealWidth },
    height: { ideal: CAMERA.idealHeight },
    frameRate: { ideal: CAMERA.idealFps },
  },
};
const UNCONSTRAINED: MediaStreamConstraints = { audio: false, video: true };

/** Creates the browser camera. Nothing is requested until `start()`. */
export function createBrowserCamera(): BrowserCamera {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');

  // One PermissionStatus for the session; null where the Permissions API can't report
  // the camera (it throws in some browsers).
  let status: Promise<PermissionStatus | null> | null = null;
  const permissionStatus = (): Promise<PermissionStatus | null> => {
    status ??= navigator.permissions
      ? navigator.permissions.query({ name: 'camera' }).catch(() => null)
      : Promise.resolve(null);
    return status;
  };

  return {
    video,
    secure: () => window.isSecureContext,
    hasMediaDevices: () => typeof navigator.mediaDevices?.getUserMedia === 'function',

    async start() {
      let stream: MediaStream;
      let retried = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia(IDEAL);
      } catch (error) {
        const info = errorInfo(error);
        if (!shouldRetryWithoutConstraints(info)) return { ok: false, error: info };
        retried = true;
        try {
          stream = await navigator.mediaDevices.getUserMedia(UNCONSTRAINED);
        } catch (second) {
          return { ok: false, error: errorInfo(second) };
        }
      }
      const track = stream.getVideoTracks()[0];
      if (!track) {
        for (const t of stream.getTracks()) t.stop();
        return { ok: false, error: { name: 'NotFoundError', message: 'No video track.' } };
      }
      return { ok: true, session: createSession(video, stream, track, retried) };
    },

    async permission() {
      return (await permissionStatus())?.state ?? 'unknown';
    },

    watchPermission(listener) {
      void permissionStatus().then((s) => {
        s?.addEventListener('change', () => listener(s.state));
      });
    },
  };
}

function createSession(
  video: HTMLVideoElement,
  stream: MediaStream,
  track: MediaStreamTrack,
  retriedUnconstrained: boolean,
): CameraSession {
  const settings = track.getSettings();
  const endedListeners: (() => void)[] = [];
  const onTrackEnded = (): void => {
    for (const listener of endedListeners.splice(0)) listener();
  };
  track.addEventListener('ended', onTrackEnded);

  return {
    actual: {
      width: settings.width ?? 0,
      height: settings.height ?? 0,
      frameRate: settings.frameRate ?? null,
      label: track.label,
    },
    retriedUnconstrained,

    show() {
      video.srcObject = stream;
      // A muted live stream may always play; a rejection only means the play was
      // interrupted by a newer stream or a stop, which needs no action.
      video.play().catch(() => undefined);
    },

    onEnded(listener) {
      endedListeners.push(listener);
    },

    stop() {
      track.removeEventListener('ended', onTrackEnded);
      endedListeners.length = 0;
      for (const t of stream.getTracks()) t.stop();
      if (video.srcObject === stream) video.srcObject = null;
    },
  };
}
