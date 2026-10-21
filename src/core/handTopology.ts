// The hand as MediaPipe's model describes it: 21 landmarks, numbered from the wrist out
// along each finger. Shared vocabulary: perception measures with it (T5: wand point and
// pinch), presentation draws with it (the preview skeleton).

/** Landmarks per hand. */
export const LANDMARK_COUNT = 21;

/** The landmarks the game uses by name (FR-3, FR-4). */
export const LANDMARK = {
  wrist: 0,
  thumbTip: 4,
  indexTip: 8,
  /** The middle finger's knuckle: wrist → here is the palm length that scales the pinch. */
  middleMcp: 9,
} as const;

/** The two fingertips whose midpoint is the wand point (D-003). */
export const WAND_TIPS: readonly number[] = [LANDMARK.thumbTip, LANDMARK.indexTip];

/** The bones between landmarks: each finger from the wrist out, then across the palm. */
export const HAND_BONES: readonly (readonly [number, number])[] = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring
  [13, 14],
  [14, 15],
  [15, 16],
  // Little finger
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Across the palm
  [5, 9],
  [9, 13],
  [13, 17],
];
