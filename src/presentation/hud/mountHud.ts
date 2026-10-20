import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import { createCameraCard } from './cameraCard';
import { cameraNotice } from './cameraCopy';
import './hud.css';
import type { Platform } from './platform';
import { createToasts } from './toasts';
import { createWebcamPip } from './webcamPip';

/** What the HUD needs from the bootstrap. */
export interface HudOptions {
  parent: HTMLElement;
  bus: EventBus<EventMap>;
  /** The camera's <video>; the preview shows it. */
  video: HTMLVideoElement;
  platform: Platform;
  now: () => number;
}

/** Builds the HUD once (T3: webcam preview, camera card, toasts). Mount before the camera starts. */
export function mountHud(options: HudOptions): void {
  const { parent, bus, video, platform, now } = options;
  createWebcamPip(parent, bus, video);
  createCameraCard({ parent, bus, platform, now });
  createToasts(parent, bus, now);

  // Camera changes that deserve a word become toasts.
  let previous: EventMap['camera:status']['state'] | null = null;
  bus.on('camera:status', (status) => {
    const notice = cameraNotice(previous, status);
    previous = status.state;
    if (notice) bus.emit('system:message', notice);
  });
}
