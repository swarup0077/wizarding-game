import { DEBUG, SKELETON } from '../../config/tuning';
import { createFpsMeter } from '../../core/fpsMeter';
import { createRollingStats } from '../../core/rollingStats';
import type { Vec2 } from '../../core/types';
import { coverFit } from './coverFit';
import { drawSkeleton, readSkeletonInk, type SkeletonInk } from './handSkeleton';

// The synchronized preview (T4 part 3): each analysed camera frame is drawn together with its
// own skeleton, so the two always match. Detection runs in a worker and takes a while, so the
// live <video> is ahead of any result; drawing the analysed frame itself removes that skew, at
// the cost of showing the picture a little later (its lag is measured).
//
// Browser-only and thin: placement is coverFit (pure), the skeleton is handSkeleton. The frame
// is mirrored here, like the <video> is by CSS; the points are already in selfie space.
// Every frame handed in is closed here, drawn or not.

/** What the preview costs and how late its picture is. */
export interface SyncedPreviewStats {
  /** Pictures drawn per second (the tracking rate). */
  fps: number;
  /** Main-thread time per drawn picture (frame + skeleton). */
  drawMeanMs: number;
  drawP95Ms: number;
  /** How far the drawn picture is behind the camera (now − capture time, at draw). */
  lagMeanMs: number;
  lagP95Ms: number;
}

/** The preview canvas. */
export interface SyncedPreview {
  readonly canvas: HTMLCanvasElement;
  /** Draws `frame` and its skeleton, then closes the frame. */
  draw(frame: VideoFrame, points: readonly Vec2[], captureTime: number): void;
  /** Clears the canvas, so the live <video> under it shows. */
  clear(): void;
  stats: () => SyncedPreviewStats;
}

/** Creates the preview canvas (it goes in the picture frame's overlay slot). */
export function createSyncedPreview(): SyncedPreview {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext('2d');
  const drawMs = createRollingStats(DEBUG.previewStatsWindow);
  const lagMs = createRollingStats(DEBUG.previewStatsWindow);
  const meter = createFpsMeter(DEBUG.fpsWindowMs);
  let ink: SkeletonInk | null = null;
  let boxW = 0;
  let boxH = 0;
  let drawn = false;

  // Track the window's size without reading layout on every frame.
  new ResizeObserver(([entry]) => {
    if (!entry) return;
    boxW = entry.contentRect.width;
    boxH = entry.contentRect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, SKELETON.maxPixelRatio);
    canvas.width = Math.round(boxW * ratio);
    canvas.height = Math.round(boxH * ratio);
    g?.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawn = false;
  }).observe(canvas);

  return {
    canvas,

    draw(frame, points, captureTime) {
      try {
        if (!g || boxW === 0) return;
        const start = performance.now();
        ink ??= readSkeletonInk();
        const fit = coverFit(frame.displayWidth, frame.displayHeight, boxW, boxH);
        // The picture, mirrored like a selfie (the crop is centred, so the fit is unchanged).
        g.save();
        g.translate(boxW, 0);
        g.scale(-1, 1);
        g.drawImage(frame, fit.offsetX, fit.offsetY, fit.width, fit.height);
        g.restore();
        drawSkeleton(g, points, fit, ink);
        drawn = true;
        const end = performance.now();
        drawMs.add(end - start);
        lagMs.add(end - captureTime);
        meter.tick(end);
      } finally {
        frame.close();
      }
    },

    clear() {
      if (!g || !drawn) return;
      g.clearRect(0, 0, boxW, boxH);
      drawn = false;
    },

    stats() {
      return {
        fps: meter.read(performance.now()),
        drawMeanMs: drawMs.mean(),
        drawP95Ms: drawMs.p95(),
        lagMeanMs: lagMs.mean(),
        lagP95Ms: lagMs.p95(),
      };
    },
  };
}
