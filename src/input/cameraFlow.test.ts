import { describe, expect, it } from 'vitest';
import type { CameraFailureKind } from '../core/types';
import {
  type CameraFlowInput,
  type CameraFlowState,
  INITIAL_CAMERA_FLOW,
  stepCameraFlow,
} from './cameraFlow';

/** Runs inputs from the initial state; returns the final state and every command issued. */
function run(...inputs: CameraFlowInput[]) {
  let state: CameraFlowState = INITIAL_CAMERA_FLOW;
  const commands: (string | null)[] = [];
  const autos: boolean[] = [];
  for (const input of inputs) {
    const step = stepCameraFlow(state, input);
    state = step.state;
    commands.push(step.command);
    autos.push(step.auto);
  }
  return { state, commands, autos };
}

const request: CameraFlowInput = { type: 'request' };
const granted: CameraFlowInput = { type: 'permissionGranted' };
const useMouse: CameraFlowInput = { type: 'useMouse' };
const started = (attempt: number): CameraFlowInput => ({ type: 'started', attempt });
const failed = (attempt: number, kind: CameraFailureKind = 'denied-by-user'): CameraFlowInput => ({
  type: 'failed',
  attempt,
  kind,
});

describe('cameraFlow', () => {
  it('starts idle and goes live after a click and a success', () => {
    const { state, commands } = run(request, started(1));
    expect(state).toEqual({ phase: 'live', failure: null, attempt: 1 });
    expect(commands).toEqual(['start', null]);
  });

  it('ignores a second click while starting or live', () => {
    expect(run(request, request).commands).toEqual(['start', null]);
    expect(run(request, started(1), request).commands).toEqual(['start', null, null]);
  });

  it('records the failure kind, and Retry starts a new attempt', () => {
    const afterFail = run(request, failed(1, 'not-found'));
    expect(afterFail.state).toEqual({ phase: 'failed', failure: 'not-found', attempt: 1 });
    const retried = run(request, failed(1, 'not-found'), request, started(2));
    expect(retried.state.phase).toBe('live');
    expect(retried.commands).toEqual(['start', null, 'start', null]);
  });

  describe('permission changes to granted', () => {
    it('start the camera by itself after a denial', () => {
      const { state, commands, autos } = run(request, failed(1, 'denied-by-user'), granted);
      expect(state.phase).toBe('starting');
      expect(state.attempt).toBe(2);
      expect(commands.at(-1)).toBe('start');
      expect(autos.at(-1)).toBe(true);
    });

    it('also recover a dismissed prompt and a system block', () => {
      expect(run(request, failed(1, 'dismissed'), granted).state.phase).toBe('starting');
      expect(run(request, failed(1, 'denied-by-system'), granted).state.phase).toBe('starting');
    });

    it('never start the camera before the player has asked', () => {
      expect(run(granted).commands).toEqual([null]);
      expect(run(granted).state.phase).toBe('idle');
    });

    it('do nothing for failures a permission cannot fix, or in mouse mode', () => {
      expect(run(request, failed(1, 'in-use'), granted).state.phase).toBe('failed');
      expect(run(useMouse, granted).state.phase).toBe('off');
    });
  });

  it('an ended track stops the camera and reports the failure (mouse meanwhile)', () => {
    const { state, commands } = run(request, started(1), { type: 'ended', kind: 'ended' });
    expect(state).toEqual({ phase: 'failed', failure: 'ended', attempt: 1 });
    expect(commands.at(-1)).toBe('stop');
  });

  it('ignores an ended event when nothing is live', () => {
    expect(run({ type: 'ended', kind: 'ended' }).state.phase).toBe('idle');
  });

  it('Use the mouse stops a live camera and clears the failure', () => {
    expect(run(request, started(1), useMouse).commands.at(-1)).toBe('stop');
    const fromFailure = run(request, failed(1), useMouse);
    expect(fromFailure.state).toEqual({ phase: 'off', failure: null, attempt: 1 });
    expect(fromFailure.commands.at(-1)).toBeNull();
  });

  it('the camera can be asked for again after choosing the mouse', () => {
    const { state } = run(useMouse, request, started(1));
    expect(state.phase).toBe('live');
  });

  describe('stale results', () => {
    it('a success after the player chose the mouse is discarded', () => {
      const { state, commands } = run(request, useMouse, started(1));
      expect(state.phase).toBe('off');
      expect(commands.at(-1)).toBe('discard');
    });

    it('a result from an older attempt is ignored', () => {
      // Attempt 1 is abandoned (mouse), attempt 2 is running; attempt 1's late results lose.
      const late = run(request, useMouse, request, started(1));
      expect(late.state).toEqual({ phase: 'starting', failure: null, attempt: 2 });
      expect(late.commands.at(-1)).toBe('discard');
      const lateFail = run(request, useMouse, request, failed(1));
      expect(lateFail.state.phase).toBe('starting');
      expect(run(request, useMouse, request, failed(1), started(2)).state.phase).toBe('live');
    });
  });
});
