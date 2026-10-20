/** A point in normalized [0,1] coordinates: top-left origin, mirrored like a selfie. */
export type Vec2 = { x: number; y: number };

/** A wand point with its timestamp (`performance.now()` milliseconds). */
export type TracePoint = Vec2 & { t: number };

/** A spell's id, e.g. 'lumos'. A plain string so new spells are pure data. */
export type SpellId = string;

/** How strong a cast was. Shown to the player as Weak / Good / Strong. */
export type Tier = 'weak' | 'normal' | 'strong';
