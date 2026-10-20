import { HUD } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import type { Settings } from '../../core/settingsTypes';
import { pictureFrame, setFrameStyle, setStatusTag, statusTag } from '../../ui';
import { CAMERA_LABELS } from './cameraCopy';
import { type HandState, previewView } from './previewState';

/** What the preview needs. */
export interface WebcamPipOptions {
  parent: HTMLElement;
  bus: EventBus<EventMap>;
  video: HTMLVideoElement;
  /** Settings at startup; later changes arrive as `settings:changed`. */
  settings: Readonly<Settings>;
}

/**
 * The webcam preview (FR-20), bottom-right and mirrored like a selfie, in the frame style
 * chosen by `previewFrame`. It never takes clicks, so strokes drawn over it reach the stage.
 * With `showPreview` off (P) the picture is hidden with opacity, so the video keeps playing
 * for the tracker, and a small status chip takes its place. Both are built once.
 */
export function createWebcamPip(options: WebcamPipOptions): void {
  const { parent, bus, video } = options;
  let settings = options.settings;
  let cameraLive = false;
  let hand: HandState = 'unknown';

  const frame = pictureFrame(video, { style: settings.previewFrame, plate: CAMERA_LABELS.plate });
  frame.classList.add('wg-pip');
  frame.setAttribute('aria-hidden', 'true');
  const vw = HUD.pipWidthFraction * 100;
  frame.style.width = `clamp(${HUD.pipMinWidthPx}px, ${vw}vw, ${HUD.pipMaxWidthPx}px)`;

  const chip = statusTag('');
  chip.classList.add('wg-pip-chip');
  for (const el of [frame, chip]) {
    el.style.right = `${HUD.pipMarginPx}px`;
    el.style.bottom = `${HUD.pipMarginPx}px`;
  }
  parent.append(frame, chip);

  function render(): void {
    const view = previewView({ cameraLive, showPreview: settings.showPreview, hand });
    frame.classList.toggle('is-shown', view.frameShown);
    chip.classList.toggle('is-shown', view.chipShown);
    setStatusTag(chip, view.chipText, view.chipTone);
  }

  bus.on('camera:status', ({ state }) => {
    cameraLive = state === 'live';
    if (!cameraLive) hand = 'unknown';
    render();
  });
  bus.on('hand:found', () => {
    hand = 'found';
    render();
  });
  bus.on('hand:lost', () => {
    hand = 'lost';
    render();
  });
  bus.on('settings:changed', ({ settings: next, changed }) => {
    settings = next;
    if (changed.includes('previewFrame')) setFrameStyle(frame, next.previewFrame);
    render();
  });
  render();
}
