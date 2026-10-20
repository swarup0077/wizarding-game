import type { CameraFailureKind } from '../core/types';

// The camera's recovery rules as a pure state machine (FR-1, NFR-3): what each click,
// result and browser event does, and which command the controller must then carry out.
//
// Every start gets an attempt number. A result belonging to an older attempt, or one that
// arrives after the player chose the mouse, is stale: a stale success must have its stream
// stopped at once (`discard`), so the camera light never stays on unwanted.

/** Where the camera is. `off`: the player chose the mouse. */
export type CameraPhase = 'idle' | 'starting' | 'live' | 'failed' | 'off';

/** The state the machine keeps. */
export interface CameraFlowState {
  phase: CameraPhase;
  /** Set only while `failed`. */
  failure: CameraFailureKind | null;
  /** The number of the current (or latest) start. */
  attempt: number;
}

/** Everything that can happen to the camera. */
export type CameraFlowInput =
  /** Enable camera or Retry was pressed. */
  | { type: 'request' }
  /** The camera permission just changed to granted. */
  | { type: 'permissionGranted' }
  | { type: 'started'; attempt: number }
  | { type: 'failed'; attempt: number; kind: CameraFailureKind }
  /** The running camera stopped (unplugged, taken by another app, access revoked). */
  | { type: 'ended'; kind: CameraFailureKind }
  | { type: 'useMouse' };

/** What the controller must do: start a camera, stop the running one, or stop a stale one. */
export type CameraCommand = 'start' | 'stop' | 'discard' | null;

/** One step's result. */
export interface CameraFlowStep {
  state: CameraFlowState;
  command: CameraCommand;
  /** True when this step changed the state (the controller then reports it). */
  changed: boolean;
  /** True when the camera starts by itself (access was allowed after a denial). */
  auto: boolean;
}

/** Failures that a permission change to "granted" can fix without a click. */
const FIXED_BY_PERMISSION: readonly CameraFailureKind[] = [
  'denied-by-user',
  'denied-by-system',
  'dismissed',
];

/** The state before the player has asked for the camera. */
export const INITIAL_CAMERA_FLOW: Readonly<CameraFlowState> = {
  phase: 'idle',
  failure: null,
  attempt: 0,
};

const same = (state: CameraFlowState, command: CameraCommand = null): CameraFlowStep => ({
  state,
  command,
  changed: false,
  auto: false,
});

const startFrom = (state: CameraFlowState, auto: boolean): CameraFlowStep => ({
  state: { phase: 'starting', failure: null, attempt: state.attempt + 1 },
  command: 'start',
  changed: true,
  auto,
});

/** Applies one input. Pure: returns the new state and the command to carry out. */
export function stepCameraFlow(state: CameraFlowState, input: CameraFlowInput): CameraFlowStep {
  switch (input.type) {
    case 'request':
      // Ignored while starting (a double click) or already live.
      if (state.phase === 'starting' || state.phase === 'live') return same(state);
      return startFrom(state, false);

    case 'permissionGranted':
      // Only after the player asked and was refused: the camera never starts unasked.
      if (state.phase !== 'failed' || !state.failure) return same(state);
      if (!FIXED_BY_PERMISSION.includes(state.failure)) return same(state);
      return startFrom(state, true);

    case 'started':
      if (state.phase !== 'starting' || input.attempt !== state.attempt)
        return same(state, 'discard');
      return {
        state: { ...state, phase: 'live', failure: null },
        command: null,
        changed: true,
        auto: false,
      };

    case 'failed':
      if (state.phase !== 'starting' || input.attempt !== state.attempt) return same(state);
      return {
        state: { ...state, phase: 'failed', failure: input.kind },
        command: null,
        changed: true,
        auto: false,
      };

    case 'ended':
      if (state.phase !== 'live') return same(state);
      return {
        state: { ...state, phase: 'failed', failure: input.kind },
        command: 'stop',
        changed: true,
        auto: false,
      };

    case 'useMouse':
      if (state.phase === 'off') return same(state);
      return {
        state: { ...state, phase: 'off', failure: null },
        command: state.phase === 'live' ? 'stop' : null,
        changed: true,
        auto: false,
      };
  }
}
