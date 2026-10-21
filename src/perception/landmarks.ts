import { LANDMARK_COUNT } from '../core/handTopology';
import type { Vec2 } from '../core/types';

// MediaPipe's result → the game's plain hand data. Pure.
//
// MediaPipe reports image coordinates of the raw (unmirrored) webcam frame: x grows to the
// camera's right, which is the player's left. The game works in selfie space (ARCHITECTURE:
// "mirrored like a selfie"), so x is flipped here, once, and everything downstream (the
// preview skeleton, T5's wand point) reads mirrored points.

/** A metric 3D point, in metres, centred on the hand (MediaPipe's `worldLandmarks`). */
export type Vec3 = { x: number; y: number; z: number };

/** The tracked hand in one video frame. Plain data. */
export interface HandFrame {
  /**
   * The 21 landmarks in selfie-mirrored [0,1] video coordinates. A landmark can fall a little
   * outside [0,1] when part of the hand is off the edge of the picture.
   */
  points: Vec2[];
  /** The 21 landmarks in metres (unmirrored). Distances between them don't depend on the camera's shape (FR-4, D-015). */
  world: Vec3[];
  /**
   * MediaPipe's handedness label ('Left' / 'Right') and score, as reported. MediaPipe assumes a
   * mirrored input, so on raw webcam frames the label is swapped; T13 handles that (FR-2).
   */
  handedness: { label: string; score: number } | null;
  /** The detection timestamp (ms). */
  t: number;
}

/** The parts of MediaPipe's HandLandmarkerResult this module reads. */
export interface RawHandResult {
  landmarks: { x: number; y: number; z: number }[][];
  worldLandmarks: { x: number; y: number; z: number }[][];
  handedness: { categoryName: string; score: number }[][];
}

/** Flips a point from raw-camera to selfie space (or back: the flip is its own inverse). */
export function mirrorX(p: Vec2): Vec2 {
  return { x: 1 - p.x, y: p.y };
}

/** The first tracked hand as plain, mirrored data, or null when no full hand was found. */
export function toHandFrame(result: RawHandResult, t: number): HandFrame | null {
  const image = result.landmarks[0];
  const world = result.worldLandmarks[0];
  if (!image || image.length < LANDMARK_COUNT || !world || world.length < LANDMARK_COUNT)
    return null;
  const category = result.handedness[0]?.[0];
  return {
    points: image.slice(0, LANDMARK_COUNT).map((p) => mirrorX(p)),
    world: world.slice(0, LANDMARK_COUNT).map(({ x, y, z }) => ({ x, y, z })),
    handedness: category ? { label: category.categoryName, score: category.score } : null,
    t,
  };
}
