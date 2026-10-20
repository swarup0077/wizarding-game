// Tunable numbers for the presentation layer (rendering, trail, sparkles, wand dot, effects, HUD).
// Import them from `config/tuning`, which re-exports every file in this folder.
// Distances are in square units (1 = stage height) unless a name says otherwise.

/** FR-17: rendering. */
export const RENDER = {
  /** Device pixel ratio cap, protecting frame rate on integrated graphics. Provisional: re-measured at DPR 2 in T2 and T11; final value set after T11. */
  maxDevicePixelRatio: 1.5,
  /** Allowed range for the `?dprCap=` measuring override. */
  dprCapOverrideMin: 0.5,
  dprCapOverrideMax: 3,
  /** Longest time step one frame may advance (after a hidden tab or a stall). */
  maxFrameDtMs: 100,
  /** Redraw the cached background only after resizing has been still this long. */
  resizeSettleMs: 150,
};

/** FR-18: wand trail. */
export const TRAIL = {
  fadeMs: 350,
  /** Spline points are placed about this far apart. */
  subdivisionStep: 0.004,
  /** Thin bright core: width at the head and at the tail. */
  coreWidthHead: 0.0045,
  coreWidthTail: 0.0008,
  /** The core is drawn in this many age bands, each with its own width and alpha. */
  coreBands: 14,
  /** Wide soft glow radius at the head and tail, and its strength. */
  glowRadiusHead: 0.04,
  glowRadiusTail: 0.01,
  glowAlpha: 0.3,
  /** Tighter inner glow. */
  midRadiusHead: 0.016,
  midRadiusTail: 0.004,
  midAlpha: 0.36,
  /** Glow sprites are stamped every (this × radius) along the trail. */
  stampSpacing: 0.4,
  /** Head speeds (square units per second) that map to energy 0 (calm) and 1 (energetic). */
  calmSpeed: 0.35,
  energeticSpeed: 2.6,
  /** Speed is measured over this much recent trail. */
  speedWindowMs: 40,
  /** How quickly the displayed energy follows the measured one. */
  energySmoothingMs: 110,
  /** At full energy: glow grows by this fraction, the core by this one. */
  energyGlowGain: 0.7,
  energyCoreGain: 0.25,
  /** Bright flare at the head while drawing. */
  headFlareRadius: 0.024,
  headFlareAlpha: 0.55,
  /** On release: how long a gold flash lasts, and how quickly a grey fade desaturates. */
  releaseFlashMs: 280,
  greyFadeMs: 160,
};

/** FR-18: sparkles along the trail. Lengths in square units, speeds in square units per second. */
export const SPARKLES = {
  /** Emitted per square unit travelled when calm, plus this many more at full energy. */
  perUnitCalm: 45,
  perUnitEnergetic: 160,
  cap: 400,
  lifeMinMs: 450,
  lifeMaxMs: 950,
  speedCalm: 0.03,
  speedEnergetic: 0.32,
  /** Velocity loss per second (exponential). */
  drag: 2.2,
  /** Upward drift acceleration. */
  float: 0.09,
  sizeMin: 0.004,
  sizeMax: 0.01,
  /** Gentle brightness flicker while alive. */
  twinkleHz: 7,
  twinkleDepth: 0.3,
  /** Sparkles burst along the trail on a gold release. */
  releaseBurst: 26,
};

/** FR-18: the idle wand dot. */
export const WAND_DOT = {
  coreRadius: 0.0045,
  glowRadius: 0.036,
  glowAlpha: 0.5,
  pulseHz: 0.9,
  /** Size and brightness swing ± this fraction. */
  pulseDepth: 0.16,
};

/** FR-19: spell effects. */
export const EFFECTS = {
  lumos: {
    durationMs: 10_000,
    /** Light radius for weak / normal / strong. Initial guess, tuned in T11. */
    orbRadiusByTier: { weak: 0.12, normal: 0.18, strong: 0.26 },
  },
  leviosa: {
    reach: 0.12,
    maxDurationMs: 8000,
    weakDurationMs: 3000,
    /** A pinch shorter than this drops the feather. */
    dropTapMaxMs: 250,
  },
  incendio: {
    /** Initial guess, tuned in T11. */
    burstRadius: 0.15,
    cobwebBurnMs: 1200,
    cobwebRespawnMs: 5000,
  },
};

/** FR-20: HUD. */
export const HUD = {
  resultCardMs: 2000,
  /** Webcam PiP width as a fraction of the window width, kept between the min and max. */
  pipWidthFraction: 0.2,
  pipMinWidthPx: 200,
  pipMaxWidthPx: 360,
  /** Gap between the PiP and the window's bottom-right corner. */
  pipMarginPx: 24,
  /** Toasts shown at once; a new one replaces the oldest. */
  toastMax: 3,
  /** How long a toast stays, by level. Initial guess, tuned in T13. */
  toastMs: { info: 4000, warn: 6000, error: 9000 },
};
