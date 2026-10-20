import { HUD } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import { gildedFrame } from '../../ui';
import { CAMERA_LABELS } from './cameraCopy';

/**
 * The webcam preview (FR-20): the camera's <video> in the gilded frame, a moving portrait,
 * bottom-right and mirrored like a selfie. It never takes clicks, so strokes drawn over it
 * reach the stage. Built once; shown only while the camera is live (so hidden in mouse mode).
 */
export function createWebcamPip(
  parent: HTMLElement,
  bus: EventBus<EventMap>,
  video: HTMLVideoElement,
): void {
  const frame = gildedFrame(video, CAMERA_LABELS.plate);
  frame.classList.add('wg-pip');
  frame.setAttribute('aria-hidden', 'true');
  const vw = HUD.pipWidthFraction * 100;
  frame.style.width = `clamp(${HUD.pipMinWidthPx}px, ${vw}vw, ${HUD.pipMaxWidthPx}px)`;
  frame.style.right = `${HUD.pipMarginPx}px`;
  frame.style.bottom = `${HUD.pipMarginPx}px`;
  parent.append(frame);

  bus.on('camera:status', ({ state }) => {
    frame.classList.toggle('is-shown', state === 'live');
  });
}
