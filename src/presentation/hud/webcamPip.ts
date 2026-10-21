import { HUD } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import type { Settings } from '../../core/settingsTypes';
import { pictureFrame, setFrameStyle, setStatusTag, statusTag } from '../../ui';
import { CAMERA_LABELS } from './cameraCopy';
import { createHandSkeleton } from './handSkeleton';
import { type HandState, type PreviewView, previewView, type TrackerState } from './previewState';

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
 * chosen by `previewFrame`, with the tracked hand's skeleton drawn over it. It never takes
 * clicks, so strokes drawn over it reach the stage. With `showPreview` off (P) the picture is
 * hidden with opacity, so the video keeps playing for the tracker, the skeleton isn't drawn,
 * and a small status chip takes its place. While the tracker readies, the chip shows above
 * the picture. Everything is built once.
 */
export function createWebcamPip(options: WebcamPipOptions): void {
  const { parent, bus, video } = options;
  let settings = options.settings;
  let cameraLive = false;
  let hand: HandState = 'unknown';
  let tracker: TrackerState = 'idle';
  let view: PreviewView | null = null;

  const skeleton = createHandSkeleton(video);
  const frame = pictureFrame(video, {
    style: settings.previewFrame,
    plate: CAMERA_LABELS.plate,
    overlay: skeleton.canvas,
  });
  frame.classList.add('wg-pip');
  frame.setAttribute('aria-hidden', 'true');
  const vw = HUD.pipWidthFraction * 100;
  frame.style.width = `clamp(${HUD.pipMinWidthPx}px, ${vw}vw, ${HUD.pipMaxWidthPx}px)`;

  const chip = statusTag('');
  chip.classList.add('wg-pip-chip');

  // One corner holds both: the chip stacks above the picture when both show.
  const corner = document.createElement('div');
  corner.className = 'wg-pip-corner';
  corner.style.right = `${HUD.pipMarginPx}px`;
  corner.style.bottom = `${HUD.pipMarginPx}px`;
  corner.style.gap = `${HUD.pipChipGapPx}px`;
  corner.append(chip, frame);
  parent.append(corner);

  function render(): void {
    view = previewView({ cameraLive, showPreview: settings.showPreview, hand, tracker });
    frame.classList.toggle('is-shown', view.frameShown);
    chip.classList.toggle('is-shown', view.chipShown);
    setStatusTag(chip, view.chipText, view.chipTone);
    // A hidden picture gets no drawing; clearing means it never reappears with a stale hand.
    if (!view.skeletonShown) skeleton.clear();
  }

  bus.on('camera:status', ({ state }) => {
    cameraLive = state === 'live';
    if (!cameraLive) hand = 'unknown';
    render();
  });
  bus.on('tracker:status', ({ state }) => {
    tracker = state;
    render();
  });
  bus.on('hand:landmarks', ({ points }) => {
    if (view?.skeletonShown) skeleton.draw(points);
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
