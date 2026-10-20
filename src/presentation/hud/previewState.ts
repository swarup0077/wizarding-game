import type { StatusTagTone } from '../../ui';
import { PREVIEW_COPY } from './cameraCopy';

// What the webcam preview corner shows. Pure. Hiding the picture (P) only swaps the frame
// for a small status chip; the camera, and hand tracking from T4, keep running.

/** Whether a hand is tracked: unknown until the first hand event (T5 emits them). */
export type HandState = 'unknown' | 'found' | 'lost';

/** The inputs that decide the corner. */
export interface PreviewInputs {
  cameraLive: boolean;
  showPreview: boolean;
  hand: HandState;
}

/** What the corner shows. */
export interface PreviewView {
  frameShown: boolean;
  chipShown: boolean;
  chipText: string;
  chipTone: StatusTagTone;
}

/** Decides what the preview corner shows. */
export function previewView({ cameraLive, showPreview, hand }: PreviewInputs): PreviewView {
  const chipText =
    hand === 'found'
      ? PREVIEW_COPY.chipHandSeen
      : hand === 'lost'
        ? PREVIEW_COPY.chipHandLost
        : PREVIEW_COPY.chipCameraOn;
  return {
    frameShown: cameraLive && showPreview,
    chipShown: cameraLive && !showPreview,
    chipText,
    chipTone: hand === 'lost' ? 'alert' : 'quiet',
  };
}
