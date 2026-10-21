import type { Vec2 } from '../../core/types';

// Where a point of the video lands inside the preview window (pure). The preview shows the
// video with `object-fit: cover` in a 4:3 window: scaled to fill it, centred, overflow cut
// off. A 16:9 webcam therefore loses its left and right edges, so a landmark's place in the
// video is not its place in the window: the skeleton must get the same fit as the picture.
// The crop is centred, so the same fit works for mirrored and unmirrored points alike.

/** How video coordinates map into the window. */
export interface CoverFit {
  /** Size of the whole scaled video, in window px (at least the window's size). */
  width: number;
  height: number;
  /** Where the scaled video's top-left corner sits (zero or negative: cut off). */
  offsetX: number;
  offsetY: number;
}

/** The `object-fit: cover` placement of a `videoW`×`videoH` video in a `boxW`×`boxH` window. */
export function coverFit(videoW: number, videoH: number, boxW: number, boxH: number): CoverFit {
  if (videoW <= 0 || videoH <= 0) return { width: boxW, height: boxH, offsetX: 0, offsetY: 0 };
  const scale = Math.max(boxW / videoW, boxH / videoH);
  const width = videoW * scale;
  const height = videoH * scale;
  return { width, height, offsetX: (boxW - width) / 2, offsetY: (boxH - height) / 2 };
}

/** A normalized video point → window px. */
export function toWindowPx(p: Vec2, fit: CoverFit): Vec2 {
  return { x: fit.offsetX + p.x * fit.width, y: fit.offsetY + p.y * fit.height };
}
