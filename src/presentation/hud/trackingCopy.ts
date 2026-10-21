import type { EventMap } from '../../core/events';
import type { TrackerFailureKind } from '../../core/types';

// Every hand-tracking line the player reads (FR-2). Pure. All wording is original
// (docs/ART_DIRECTION.md, IP guardrails): plain language, with the next step in each message.

/** Words for the tracker, outside the toasts. */
export const TRACKING_COPY = {
  /** The status chip while the tracker downloads after "Enable camera". */
  readying: 'Readying your wand…',
};

const FAILURE_TEXT: Record<TrackerFailureKind, string> = {
  unsupported:
    "This browser can't follow your hand. The mouse is your wand here; Chrome or Edge can follow your hand.",
  'load-failed':
    "Hand tracking couldn't start, so the mouse is your wand for now. Reloading the page may help.",
};

/** The low-tracking-fps tip (FR-2): lighting and distance, as one ink note. */
export function slowTrackingTip(minCm: number, maxCm: number): string {
  return (
    'Your wand hand is hard to follow. More light on your hand helps, and so does keeping it ' +
    `about ${minCm}–${maxCm} cm from the camera.`
  );
}

/** The ink note a tracker status deserves, if any: only a failure, with the mouse offered. */
export function trackerNotice(
  status: EventMap['tracker:status'],
): EventMap['system:message'] | null {
  if (status.state !== 'failed') return null;
  return {
    level: 'error',
    text: FAILURE_TEXT[status.failure ?? 'load-failed'],
    action: { id: 'camera.useMouse', label: 'Use the mouse instead' },
  };
}
