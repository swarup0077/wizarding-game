import type { EventMap } from '../../core/events';
import type { CameraFailureKind } from '../../core/types';
import type { Platform } from './platform';

// Every camera line the player reads (FR-1). Pure, so each kind is tested on each platform.
// All wording is original (docs/ART_DIRECTION.md, IP guardrails): plain language first, with
// the next step in every message.

/** What the camera card shows for one state. */
export interface CameraCopy {
  title: string;
  body: string;
  /** False where retrying can't help (an insecure page, a browser without a camera API). */
  retry: boolean;
}

/** Button labels and the preview's name plate. */
export const CAMERA_LABELS = {
  enable: 'Enable camera',
  retry: 'Retry',
  useMouse: 'Use the mouse instead',
  plate: 'Your wand hand',
};

/** The temporary "Enable camera" card (T13's acceptance letter replaces it). */
export const CAMERA_INTRO: CameraCopy = {
  title: 'Your wand hand',
  body: 'The camera follows your hand so it can be your wand. The picture stays on this computer.',
  retry: true,
};

const MAC_SETTINGS = 'System Settings → Privacy & Security → Camera';
const WINDOWS_SETTINGS = 'Settings → Privacy & security → Camera';

type CopyFor = (platform: Platform) => CameraCopy;

const COPY: Record<CameraFailureKind, CopyFor> = {
  'denied-by-user': (platform) => ({
    title: 'The camera is blocked',
    body:
      'Chrome was told not to share the camera with this page. Click the camera icon at the ' +
      'right end of the address bar and choose Allow. The game will notice and start it.' +
      {
        mac: ` If it already says Allow, your Mac may be blocking Chrome: see ${MAC_SETTINGS}.`,
        windows: ` If it already says Allow, check Windows ${WINDOWS_SETTINGS}.`,
        other: '',
      }[platform],
    retry: true,
  }),
  'denied-by-system': (platform) =>
    ({
      mac: {
        title: 'Your Mac is keeping the camera from Chrome',
        body:
          `Open ${MAC_SETTINGS} and turn on Google Chrome. macOS will ask to reopen Chrome, ` +
          'and this tab comes back with it.',
        retry: true,
      },
      windows: {
        title: 'Windows is keeping the camera from Chrome',
        body:
          `Open ${WINDOWS_SETTINGS}, turn on camera access for desktop apps, ` +
          'then press Retry.',
        retry: true,
      },
      other: {
        title: 'Your computer is keeping the camera from Chrome',
        body: "Allow Chrome to use the camera in your system's privacy settings, then press Retry.",
        retry: true,
      },
    })[platform],
  dismissed: () => ({
    title: 'The question was closed',
    body:
      'Chrome asked about the camera, but the question closed before an answer. ' +
      'Press Retry to be asked again.',
    retry: true,
  }),
  'not-found': () => ({
    title: 'No camera found',
    body: "Chrome can't see a camera on this computer. Plug one in or switch it on, then press Retry.",
    retry: true,
  }),
  'in-use': (platform) => ({
    title: 'The camera is busy',
    body:
      'Another app may be using it, often Teams, Zoom or the Camera app. ' +
      'Close it, then press Retry.' +
      (platform === 'windows'
        ? ` If nothing else is open, check Windows ${WINDOWS_SETTINGS}.`
        : ''),
    retry: true,
  }),
  insecure: () => ({
    title: 'The camera needs a secure page',
    body:
      'Browsers share the camera only with pages opened over https:// or on this computer. ' +
      'Open the game from its https:// link.',
    retry: false,
  }),
  unsupported: () => ({
    title: "This browser can't share a camera",
    body: 'Open the game in Chrome or Edge.',
    retry: false,
  }),
  aborted: () => ({
    title: "The camera didn't start",
    body:
      'Something interrupted it while it was waking. Press Retry. ' +
      'If it keeps happening, restart Chrome.',
    retry: true,
  }),
  ended: () => ({
    title: 'The camera stopped',
    body:
      'It may have been unplugged or taken by another app. The mouse is your wand for now. ' +
      'Press Retry when the camera is back.',
    retry: true,
  }),
  unknown: () => ({
    title: "The camera didn't start",
    body: "Chrome reported a problem we don't recognise. Press Retry, or use the mouse.",
    retry: true,
  }),
};

/** The words for one camera failure on one platform. */
export function cameraCopy(kind: CameraFailureKind, platform: Platform): CameraCopy {
  return COPY[kind](platform);
}

/** Every failure kind, in a stable order (tests and the dev trigger). */
export const CAMERA_FAILURE_KINDS = Object.keys(COPY) as CameraFailureKind[];

/** True when `value` names a camera failure kind. */
export function isCameraFailureKind(value: string | null): value is CameraFailureKind {
  return value !== null && (CAMERA_FAILURE_KINDS as string[]).includes(value);
}

type CameraStatus = EventMap['camera:status'];
type Notice = EventMap['system:message'];

/**
 * The ink-note toast a camera change deserves, if any. `previous` is the state before
 * this status (null at startup).
 */
export function cameraNotice(
  previous: CameraStatus['state'] | null,
  status: CameraStatus,
): Notice | null {
  if (status.state === 'off' && previous !== 'off')
    return { level: 'info', text: 'Using the mouse: hold the left button and draw.' };
  if (status.state === 'starting' && status.auto)
    return { level: 'info', text: 'Camera allowed. Waking it now.' };
  if (status.state === 'live' && status.retriedUnconstrained)
    return {
      level: 'info',
      text: "Your camera didn't take the usual picture size, so it's using its own.",
    };
  return null;
}
