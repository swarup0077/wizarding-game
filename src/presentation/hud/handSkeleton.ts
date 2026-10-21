import { SKELETON } from '../../config/tuning';
import { HAND_BONES, WAND_TIPS } from '../../core/handTopology';
import type { Vec2 } from '../../core/types';
import { type CoverFit, toWindowPx } from './coverFit';

// The hand skeleton (FR-20), drawn over the analysed picture by the synchronized preview.
//
// Look (docs/ART_DIRECTION.md): candle gold, not debug colours. Each bone is a thin gold ink
// line over a wider, faint gilt glow, drawn as two plain strokes (no shadowBlur: D-036).
// Joints are small pale-gold dots. The thumb and index tips, whose midpoint becomes the wand
// point in T5, are larger warm parchment-white beads with a soft halo, like the trail's head.
// Colours come from the theme's tokens, so the kit stays the single source.
// Points arrive already mirrored (selfie space), matching the mirrored picture.

/** The skeleton's colours, read from the theme. */
export interface SkeletonInk {
  bone: string;
  glow: string;
  joint: string;
  tip: string;
}

/** The theme's colours for the skeleton (src/ui/theme.css). Read once; they don't change. */
export function readSkeletonInk(): SkeletonInk {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    bone: token('--gold-400'),
    glow: token('--gold-600'),
    joint: token('--gold-200'),
    tip: token('--parchment-100'),
  };
}

/** Draws the skeleton of `points` (normalized video coordinates) placed by `fit`, in CSS px. */
export function drawSkeleton(
  g: CanvasRenderingContext2D,
  points: readonly Vec2[],
  fit: CoverFit,
  ink: SkeletonInk,
): void {
  if (points.length === 0) return;
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
