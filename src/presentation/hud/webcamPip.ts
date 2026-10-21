import { HUD } from '../../config/tuning';
import type { EventBus } from '../../core/eventBus';
import type { EventMap } from '../../core/events';
import type { Settings } from '../../core/settingsTypes';
import type { Vec2 } from '../../core/types';
import { pictureFrame, setFrameStyle, setStatusTag, statusTag } from '../../ui';
import { CAMERA_LABELS } from './cameraCopy';
import { type HandState, type PreviewView, previewView, type TrackerState } from './previewState';
import { createSyncedPreview, type SyncedPreviewStats } from './syncedPreview';

/** Receives each analysed picture with its landmarks; must close the frame. */
export type PreviewFrameSink = (
  frame: VideoFrame,
  points: readonly Vec2[],
  captureTime: number,
) => void;

/** What the preview needs. */
export interface WebcamPipOptions {
  parent: HTMLElement;
  bus: EventBus<EventMap>;
  video: HTMLVideoElement;
  /** Settings at startup; later changes arrive as `settings:changed`. */
  settings: Readonly<Settings>;
  /** Hands the preview's sink to the tracker (main.ts wires it: frames can't go on the bus). */
  connectFrames: (sink: PreviewFrameSink) => void;
}

/** The running preview. */
export interface WebcamPip {
  stats: () => SyncedPreviewStats;
}

/**
 * The webcam preview (FR-20), bottom-right and mirrored like a selfie, in the frame style
 * chosen by `previewFrame`. While tracking, it shows each analysed picture with its own
 * skeleton (the synchronized preview, T4 part 3), drawn over the live <video>; before the
 * first result, or if results stop, the live <video> under it shows. It never takes clicks.
 * With `showPreview` off (P) nothing is drawn (frames are closed unseen), the video keeps
 * playing for the tracker, and a small status chip takes the picture's place. Built once.
 */
export function createWebcamPip(options: WebcamPipOptions): WebcamPip {
  const { parent, bus, video } = options;
  let settings = options.settings;
  let cameraLive = false;
  let hand: HandState = 'unknown';
  let tracker: TrackerState = 'idle';
  let view: PreviewView | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;

  const synced = createSyncedPreview();
  const frame = pictureFrame(video, {
    style: settings.previewFrame,
    plate: CAMERA_LABELS.plate,
    overlay: synced.canvas,
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
    if (!view.skeletonShown) synced.clear();
  }

  options.connectFrames((picture, points, captureTime) => {
    if (!view?.skeletonShown) {
      picture.close(); // hidden, or not tracking: never drawn
      return;
    }
    synced.draw(picture, points, captureTime);
    // If results stop, fall back to the live <video> under the canvas.
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = setTimeout(() => synced.clear(), HUD.previewStaleMs);
  });

  bus.on('camera:status', ({ state }) => {
    cameraLive = state === 'live';
    if (!cameraLive) hand = 'unknown';
    render();
  });
  bus.on('tracker:status', ({ state }) => {
    tracker = state;
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

  return { stats: () => synced.stats() };
}
