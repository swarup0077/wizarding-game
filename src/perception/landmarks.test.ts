import { describe, expect, it } from 'vitest';
import { LANDMARK } from '../core/handTopology';
import { mirrorX, type RawHandResult, toHandFrame } from './landmarks';

function rawHand(xOffset = 0): RawHandResult {
  const points = Array.from({ length: 21 }, (_, i) => ({
    x: 0.1 + xOffset + i * 0.01,
    y: 0.2 + i * 0.02,
    z: -0.01 * (i + 1), // never -0, which JSON turns into 0
  }));
  return {
    landmarks: [points],
    worldLandmarks: [points.map((p) => ({ x: p.x - 0.2, y: p.y - 0.3, z: p.z }))],
    handedness: [[{ categoryName: 'Right', score: 0.97 }]],
  };
}

describe('mirrorX', () => {
  it('flips x around the centre and keeps y; flipping twice gives the original', () => {
    expect(mirrorX({ x: 0.2, y: 0.7 })).toEqual({ x: 0.8, y: 0.7 });
    const twice = mirrorX(mirrorX({ x: 0.31, y: 0.4 }));
    expect(twice.x).toBeCloseTo(0.31, 12);
    expect(twice.y).toBe(0.4);
  });
});

describe('toHandFrame', () => {
  it("mirrors image points into selfie space: the camera's right is the player's left", () => {
    const frame = toHandFrame(rawHand(), 1234);
    expect(frame).not.toBeNull();
    const wrist = frame?.points[LANDMARK.wrist];
    expect(wrist?.x).toBeCloseTo(0.9);
    expect(wrist?.y).toBeCloseTo(0.2);
    expect(frame?.points).toHaveLength(21);
    expect(frame?.t).toBe(1234);
  });

  it('keeps world landmarks metric and unmirrored, and copies them (no MediaPipe objects leak)', () => {
    const raw = rawHand();
    const frame = toHandFrame(raw, 0);
    expect(frame?.world[0]).toEqual(raw.worldLandmarks[0]?.[0]);
    expect(frame?.world[0]).not.toBe(raw.worldLandmarks[0]?.[0]);
  });

  it('passes the handedness label through as reported', () => {
    expect(toHandFrame(rawHand(), 0)?.handedness).toEqual({ label: 'Right', score: 0.97 });
    const noLabel = { ...rawHand(), handedness: [] };
    expect(toHandFrame(noLabel, 0)?.handedness).toBeNull();
  });

  it('is null when there is no hand or only part of one', () => {
    expect(toHandFrame({ landmarks: [], worldLandmarks: [], handedness: [] }, 0)).toBeNull();
    const partial = rawHand();
    partial.landmarks[0] = partial.landmarks[0]?.slice(0, 20) ?? [];
    expect(toHandFrame(partial, 0)).toBeNull();
  });

  it('is plain JSON data, so it can travel on the bus', () => {
    const frame = toHandFrame(rawHand(), 5);
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
  });
});
