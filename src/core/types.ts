/** A point in normalized [0,1] coordinates: top-left origin, mirrored like a selfie. */
export type Vec2 = { x: number; y: number };

/** A wand point with its timestamp (`performance.now()` milliseconds). */
export type TracePoint = Vec2 & { t: number };

/** A spell's id, e.g. 'lumos'. A plain string so new spells are pure data. */
export type SpellId = string;

/** How strong a cast was. Shown to the player as Weak / Good / Strong. */
export type Tier = 'weak' | 'normal' | 'strong';

/**
 * Why the camera isn't running (FR-1). Input reports the kind; presentation words it.
 * `ended` means the camera stopped mid-session (unplugged, or taken by another app).
 */
export type CameraFailureKind =
  | 'denied-by-user'
  | 'denied-by-system'
  | 'dismissed'
  | 'not-found'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'aborted'
  | 'ended'
  | 'unknown';

/** What the camera actually delivers (laptop webcams often give less than asked). */
export type CameraActual = {
  width: number;
  height: number;
  /** Null when the browser doesn't report it. */
  frameRate: number | null;
  /** The device name, e.g. "Integrated Webcam". */
  label: string;
};

/** A HUD button the player pressed. Input and other layers act on these through the bus. */
export type UiActionId = 'camera.enable' | 'camera.retry' | 'camera.useMouse';
