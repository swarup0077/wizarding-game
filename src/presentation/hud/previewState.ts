import type { StatusTagTone } from '../../ui';
import { PREVIEW_COPY } from './cameraCopy';
import { TRACKING_COPY } from './trackingCopy';

// What the webcam preview corner shows. Pure. Hiding the picture (P) only swaps the frame
// for a small status chip; the camera and hand tracking keep running.

/** Whether a hand is tracked: unknown until the first hand event (T5 emits them). */
export type HandState = 'unknown' | 'found' | 'lost';

/** The hand tracker's lifecycle, as the corner cares about it. */
export type TrackerState = 'idle' | 'loading' | 'ready' | 'failed';

/** The inputs that decide the corner. */
export interface PreviewInputs {
  cameraLive: boolean;
  showPreview: boolean;
  hand: HandState;
  tracker: TrackerState;
}

/** What the corner shows. */
export interface PreviewView {
  frameShown: boolean;
  /** The chip shows instead of the picture (P), or above it while the tracker is readying. */
  chipShown: boolean;
  chipText: string;
  chipTone: StatusTagTone;
  /** Whether to draw the hand skeleton: only over a visible picture. */
  skeletonShown: boolean;
}

/** Decides what the preview corner shows. */
export function previewView(inputs: PreviewInputs): PreviewView {
  const { cameraLive, showPreview, hand, tracker } = inputs;
  const readying = tracker === 'loading';
  const chipText = readying
    ? TRACKING_COPY.readying
    : hand === 'found'
      ? PREVIEW_COPY.chipHandSeen
      : hand === 'lost'
        ? PREVIEW_COPY.chipHandLost
        : PREVIEW_COPY.chipCameraOn;
  const frameShown = cameraLive && showPreview;
  return {
    frameShown,
    chipShown: cameraLive && (!showPreview || readying),
    chipText,
    chipTone: hand === 'lost' && !readying ? 'alert' : 'quiet',
    skeletonShown: frameShown && tracker === 'ready',
  };
}
