import type {
  CameraActual,
  CameraFailureKind,
  SpellId,
  Tier,
  TracePoint,
  UiActionId,
  Vec2,
} from './types';

/**
 * Every event the layers exchange, with its payload.
 * Payloads must be plain JSON-serializable data (no DOM objects, no functions),
 * so a later multiplayer phase can send them over the network unchanged.
 */
export interface EventMap {
  /**
   * The webcam's state (FR-1). `idle`: not asked for yet. `off`: the player chose the mouse.
   * `failed` carries the kind of failure and the browser's own error text (`detail`).
   */
  'camera:status': {
    state: 'idle' | 'starting' | 'live' | 'off' | 'failed';
    failure?: CameraFailureKind;
    detail?: string;
    /** On `starting`: the camera started by itself because access was just allowed. */
    auto?: boolean;
    /** On `live`: what the camera delivers. */
    actual?: CameraActual;
    /** On `live`: the camera refused the ideal size and frame rate, so its defaults are used. */
    retriedUnconstrained?: boolean;
    t: number;
  };

  'hand:found': { t: number };
  'hand:lost': { t: number };
  /** Debug and PiP skeleton only. */
  'hand:landmarks': { points: Vec2[]; t: number };

  'wand:move': { p: Vec2; t: number; source: 'hand' | 'mouse' };
  'wand:pinchStart': { p: Vec2; t: number };
  'wand:pinchEnd': { p: Vec2; t: number };

  /** `aspect` = stage width / height, used to convert to square units. */
  'trace:complete': { trace: TracePoint[]; aspect: number; durationMs: number; t: number };
  'trace:cancelled': { reason: 'too-short' | 'too-long' | 'hand-lost'; t: number };

  'gesture:recognized': {
    spellId: SpellId | null;
    score: number;
    ranked: { spellId: SpellId; score: number }[];
    durationMs: number;
    endPoint: Vec2;
    t: number;
  };

  'voice:status': {
    state: 'listening' | 'paused' | 'unsupported' | 'denied' | 'offline' | 'error';
    message?: string;
  };
  'voice:transcript': {
    alternatives: { text: string; confidence: number }[];
    isFinal: boolean;
    t: number;
  };
  'voice:matched': {
    spellId: SpellId | null;
    score: number;
    heard: string;
    isFinal: boolean;
    t: number;
  };

  'spell:cast': {
    spellId: SpellId;
    quality: number;
    tier: Tier;
    target: Vec2;
    breakdown: { shape: number; voice: number | null; speed: number };
    t: number;
  };
  'spell:miscast': {
    reason: 'unrecognized-shape' | 'voice-mismatch' | 'no-voice';
    target: Vec2;
    heard?: string;
    spellId?: SpellId;
    t: number;
  };
  /** A spell heard after an unrecognized-shape fizzle: updates the hint only (D-018). */
  'spell:miscastHeard': { spellId: SpellId; heard: string; t: number };
  /** A sustained spell finished. */
  'spell:ended': { spellId: SpellId; t: number };

  'system:message': {
    level: 'info' | 'warn' | 'error';
    text: string;
    action?: { id: UiActionId; label: string };
  };

  /** A HUD button was pressed (the camera card's seal, a toast's link...). */
  'ui:action': { id: UiActionId; t: number };
}

/** Any event name in the game. */
export type EventType = keyof EventMap;
