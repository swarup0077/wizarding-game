import type { Clock } from '../core/clock';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { CameraFailureKind } from '../core/types';
import type { Camera, CameraSession } from './camera';
import { classifyCameraError, classifyEnded, errorDetail } from './cameraErrors';
import {
  type CameraFlowInput,
  type CameraFlowState,
  INITIAL_CAMERA_FLOW,
  stepCameraFlow,
} from './cameraFlow';

// Connects the bus, the recovery rules (cameraFlow) and the browser camera. HUD buttons
// arrive as `ui:action`; every change goes out as `camera:status`. No wording here: the
// HUD turns a failure kind into words.

/** What the controller needs. */
export interface CameraControllerOptions {
  bus: EventBus<EventMap>;
  camera: Camera;
  clock: Clock;
}

/** The running controller. */
export interface CameraController {
  /** Subscribes to HUD actions and permission changes, and reports `idle`. */
  start(): void;
  /** The current flow state (debug and tests). */
  state(): CameraFlowState;
}

/** Creates the camera controller. The camera is never requested until a HUD action asks. */
export function createCameraController(options: CameraControllerOptions): CameraController {
  const { bus, camera, clock } = options;
  let state: CameraFlowState = INITIAL_CAMERA_FLOW;
  let session: CameraSession | null = null;

  function report(auto: boolean, detail?: string): void {
    const t = clock.now();
    if (state.phase === 'live' && session) {
      bus.emit('camera:status', {
        state: 'live',
        actual: session.actual,
        retriedUnconstrained: session.retriedUnconstrained,
        t,
      });
    } else if (state.phase === 'failed' && state.failure) {
      bus.emit('camera:status', { state: 'failed', failure: state.failure, detail, t });
    } else if (state.phase === 'starting') {
      bus.emit('camera:status', { state: 'starting', auto, t });
    } else {
      bus.emit('camera:status', { state: state.phase === 'off' ? 'off' : 'idle', t });
    }
  }

  function apply(input: CameraFlowInput, detail?: string): void {
    const step = stepCameraFlow(state, input);
    state = step.state;
    if (step.command === 'stop') {
      session?.stop();
      session = null;
    }
    if (step.changed) report(step.auto, detail);
    if (step.command === 'start') {
      const attempt = state.attempt;
      begin(attempt).catch((error: unknown) => {
        fail(attempt, 'unknown', `Unexpected: ${String(error)}`);
      });
    }
  }

  const fail = (attempt: number, kind: CameraFailureKind, detail: string): void =>
    apply({ type: 'failed', attempt, kind }, detail);

  async function begin(attempt: number): Promise<void> {
    const context = {
      permission: 'unknown' as const,
      secure: camera.secure(),
      hasMediaDevices: camera.hasMediaDevices(),
    };
    const early = classifyCameraError(null, context);
    if (early) {
      const detail = early === 'insecure' ? 'isSecureContext is false' : 'No getUserMedia';
      return fail(attempt, early, detail);
    }
    const result = await camera.start();
    if (result.ok) return accept(attempt, result.session);
    const permission = await camera.permission();
    const kind = classifyCameraError(result.error, { ...context, permission }) ?? 'unknown';
    fail(attempt, kind, errorDetail(result.error));
  }

  function accept(attempt: number, started: CameraSession): void {
    const step = stepCameraFlow(state, { type: 'started', attempt });
    state = step.state;
    if (step.command === 'discard') {
      started.stop();
      return;
    }
    session = started;
    started.show();
    started.onEnded(() => {
      void camera.permission().then((permission) => {
        if (session === started)
          apply({ type: 'ended', kind: classifyEnded(permission) }, 'The video track ended.');
      });
    });
    report(false);
  }

  return {
    start() {
      bus.on('ui:action', ({ id }) => {
        if (id === 'camera.enable' || id === 'camera.retry') apply({ type: 'request' });
        else if (id === 'camera.useMouse') apply({ type: 'useMouse' });
      });
      camera.watchPermission((permission) => {
        if (permission === 'granted') apply({ type: 'permissionGranted' });
      });
      report(false);
    },
    state: () => state,
  };
}
