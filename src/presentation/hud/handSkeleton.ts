import { SKELETON } from '../../config/tuning';
import { HAND_BONES, WAND_TIPS } from '../../core/handTopology';
import type { Vec2 } from '../../core/types';
import { coverFit, toWindowPx } from './coverFit';

// The hand skeleton over the webcam preview (FR-20). Browser-only and thin: the placement
// is coverFit (pure), the bones are core/handTopology.
//
// Look (docs/ART_DIRECTION.md): candle gold, not debug colours. Each bone is a thin gold ink
// line over a wider, faint gilt glow, drawn as two plain strokes (no shadowBlur: D-036).
// Joints are small pale-gold dots. The thumb and index tips, whose midpoint becomes the wand
// point in T5, are larger warm parchment-white beads with a soft halo, like the trail's head.
// Colours are read from the theme's tokens once, so the kit stays the single source.
//
// Points arrive already mirrored (selfie space), and the video is mirrored by CSS, so the
// canvas itself is not flipped. It is drawn when a frame's landmarks arrive (tracking rate,
// in step with the picture), never from the render loop.

/** The skeleton layer. */
export interface HandSkeleton {
  /** The canvas to put over the picture. */
  readonly canvas: HTMLCanvasElement;
  /** Draws one frame's landmarks; `[]` clears. */
  draw(points: readonly Vec2[]): void;
  clear(): void;
}

interface Ink {
  bone: string;
  glow: string;
  joint: string;
  tip: string;
}

/** Creates the skeleton layer for `video` (its size decides the crop). */
export function createHandSkeleton(video: HTMLVideoElement): HandSkeleton {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext('2d');
  let ink: Ink | null = null;
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

  function clear(): void {
    if (!g || !drawn) return;
    g.clearRect(0, 0, boxW, boxH);
    drawn = false;
  }

  function draw(points: readonly Vec2[]): void {
    clear();
    if (!g || points.length === 0 || boxW === 0) return;
    ink ??= readInk();
    const fit = coverFit(video.videoWidth, video.videoHeight, boxW, boxH);
    const px = points.map((p) => toWindowPx(p, fit));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    strokeBones(g, px, ink.glow, SKELETON.glowWidthPx, SKELETON.glowAlpha);
    strokeBones(g, px, ink.bone, SKELETON.boneWidthPx, SKELETON.boneAlpha);
    g.globalAlpha = 1;
    g.fillStyle = ink.joint;
    for (let i = 0; i < px.length; i++) {
      const p = px[i];
      if (p && !WAND_TIPS.includes(i)) dot(g, p, SKELETON.jointRadiusPx);
    }
    for (const i of WAND_TIPS) {
      const p = px[i];
      if (!p) continue;
      g.globalAlpha = SKELETON.tipHaloAlpha;
      g.fillStyle = ink.glow;
      dot(g, p, SKELETON.tipHaloRadiusPx);
      g.globalAlpha = 1;
      g.fillStyle = ink.tip;
      dot(g, p, SKELETON.tipRadiusPx);
    }
    drawn = true;
  }

  return { canvas, draw, clear };
}

function strokeBones(
  g: CanvasRenderingContext2D,
  px: readonly Vec2[],
  colour: string,
  width: number,
  alpha: number,
): void {
  g.globalAlpha = alpha;
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.beginPath();
  for (const [a, b] of HAND_BONES) {
    const p = px[a];
    const q = px[b];
    if (!p || !q) continue;
    g.moveTo(p.x, p.y);
    g.lineTo(q.x, q.y);
  }
  g.stroke();
}

function dot(g: CanvasRenderingContext2D, p: Vec2, radius: number): void {
  g.beginPath();
  g.arc(p.x, p.y, radius, 0, Math.PI * 2);
  g.fill();
}

/** The theme's colours for the skeleton (src/ui/theme.css). */
function readInk(): Ink {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    bone: token('--gold-400'),
    glow: token('--gold-600'),
    joint: token('--gold-200'),
    tip: token('--parchment-100'),
  };
}
