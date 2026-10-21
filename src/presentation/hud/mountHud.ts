import { HUD, TRACKING } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import type { Settings } from '../../core/settingsTypes';
import { createCameraCard } from './cameraCard';
import { cameraNotice, PREVIEW_COPY } from './cameraCopy';
import './hud.css';
import type { Platform } from './platform';
import { createToasts } from './toasts';
import { slowTrackingTip, trackerNotice } from './trackingCopy';
import { createWebcamPip } from './webcamPip';

/** What the HUD needs from the bootstrap. */
export interface HudOptions {
  parent: HTMLElement;
  bus: EventBus<EventMap>;
  /** The camera's <video>; the preview shows it. */
  video: HTMLVideoElement;
  platform: Platform;
  /** Settings at startup; later changes arrive as `settings:changed`. */
  settings: Readonly<Settings>;
  now: () => number;
}

/** Builds the HUD once (webcam preview and chip, camera card, toasts). Mount before the camera starts. */
export function mountHud(options: HudOptions): void {
  const { parent, bus, video, platform, settings, now } = options;
  createWebcamPip({ parent, bus, video, settings });
  createCameraCard({ parent, bus, platform, now });
  createToasts(parent, bus, now);

  // Camera changes that deserve a word become toasts.
  let previous: EventMap['camera:status']['state'] | null = null;
  bus.on('camera:status', (status) => {
    const notice = cameraNotice(previous, status);
    previous = status.state;
    if (notice) bus.emit('system:message', notice);
  });

  // Hand tracking: a failure offers the mouse; slow tracking gets the lighting tip, at most
  // once per cooldown so it never nags.
  bus.on('tracker:status', (status) => {
    const notice = trackerNotice(status);
    if (notice) bus.emit('system:message', notice);
  });
  let lastTipAt = -Infinity;
  bus.on('tracker:slow', ({ slow, t }) => {
    if (!slow || t - lastTipAt < HUD.slowTipCooldownMs) return;
    lastTipAt = t;
    const tip = slowTrackingTip(TRACKING.handDistanceCmMin, TRACKING.handDistanceCmMax);
    bus.emit('system:message', { level: 'warn', text: tip });
  });

  // Hiding the preview could look like the camera stopped, so say that it didn't.
  bus.on('settings:changed', ({ settings: next, changed }) => {
    if (changed.includes('showPreview') && !next.showPreview)
      bus.emit('system:message', { level: 'info', text: PREVIEW_COPY.hidden });
  });
}
