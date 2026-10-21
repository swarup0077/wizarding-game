import { DEV_CAMERA } from '../config/tuning';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { CameraFailureKind } from '../core/types';
import { isCameraFailureKind } from '../presentation/hud/cameraCopy';

// `?dev=camera`: renders camera states on demand, for screenshots and for checking the
// wording on another machine (it works on the deployed link too). Downloaded only when used.
//   &fail=<kind>       show that failure's card (e.g. fail=denied-by-system&platform=mac)
//   &enable=1          press "Enable camera" at startup (scripted fps runs)
//   &enable=<ms>       ...or this many ms after startup (T4: measures tracker start apart from page load)
//   &simulate=ended    end the real camera track a moment after it goes live

/** Typical browser error text per kind, for the card's fine print. */
const SAMPLE_DETAIL: Record<CameraFailureKind, string> = {
  'denied-by-user': 'NotAllowedError: Permission denied',
  'denied-by-system': 'NotAllowedError: Permission denied by system',
  dismissed: 'NotAllowedError: Permission dismissed',
  'not-found': 'NotFoundError: Requested device not found',
  'in-use': 'NotReadableError: Could not start video source',
  insecure: 'isSecureContext is false',
  unsupported: 'No getUserMedia',
  aborted: 'AbortError: Timeout starting video source',
  ended: 'The video track ended.',
  unknown: 'SecurityError: The operation is insecure.',
};

/** Starts the camera dev trigger. Call after the HUD and the camera controller are running. */
export function startCameraSim(
  params: URLSearchParams,
  bus: EventBus<EventMap>,
  video: HTMLVideoElement,
): void {
  const now = (): number => performance.now();
  const fail = params.get('fail');
  if (isCameraFailureKind(fail))
    bus.emit('camera:status', {
      state: 'failed',
      failure: fail,
      detail: SAMPLE_DETAIL[fail],
      t: now(),
    });

  const enable = Number(params.get('enable'));
  const pressEnable = (): void => bus.emit('ui:action', { id: 'camera.enable', t: now() });
  if (enable === 1) pressEnable();
  else if (enable > 1) setTimeout(pressEnable, enable);

  if (params.get('simulate') === 'ended') {
    let armed = true;
    bus.on('camera:status', ({ state }) => {
      if (state !== 'live' || !armed) return;
      armed = false;
      setTimeout(() => {
        const stream = video.srcObject;
        const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
        // A real unplug fires `ended`; stopping the track first makes it really stop too.
        track?.stop();
        track?.dispatchEvent(new Event('ended'));
      }, DEV_CAMERA.simulateEndedAfterMs);
    });
  }
}
