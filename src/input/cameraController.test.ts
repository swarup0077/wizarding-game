import { describe, expect, it, vi } from 'vitest';
import { createFakeClock } from '../core/clock';
import { createEventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { Camera, CameraSession, CameraStart } from './camera';
import type { CameraPermission } from './cameraErrors';
import { createCameraController } from './cameraController';

/** A camera whose results the test hands out one by one. */
function fakeCamera(options: { secure?: boolean; permission?: CameraPermission } = {}) {
  const starts: ((result: CameraStart) => void)[] = [];
  let permission: CameraPermission = options.permission ?? 'prompt';
  let permissionListener: ((p: CameraPermission) => void) | null = null;
  const camera: Camera = {
    secure: () => options.secure ?? true,
    hasMediaDevices: () => true,
    start: () => new Promise<CameraStart>((resolve) => starts.push(resolve)),
    permission: () => Promise.resolve(permission),
    watchPermission: (listener) => {
      permissionListener = listener;
    },
  };
  const setPermission = (p: CameraPermission) => {
    permission = p;
    permissionListener?.(p);
  };
  return { camera, starts, setPermission };
}

function fakeSession() {
  let ended: (() => void) | null = null;
  const show = vi.fn();
  const stop = vi.fn();
  const session: CameraSession = {
    actual: { width: 640, height: 480, frameRate: 30, label: 'Test cam' },
    retriedUnconstrained: false,
    show,
    stop,
    onEnded: (listener) => {
      ended = listener;
    },
  };
  return { session, show, stop, end: () => ended?.() };
}

function setup(options?: Parameters<typeof fakeCamera>[0]) {
  const bus = createEventBus<EventMap>();
  const statuses: EventMap['camera:status'][] = [];
  bus.on('camera:status', (s) => statuses.push(s));
  const fake = fakeCamera(options);
  const controller = createCameraController({ bus, camera: fake.camera, clock: createFakeClock() });
  controller.start();
  const click = (id: EventMap['ui:action']['id']) => bus.emit('ui:action', { id, t: 0 });
  const states = () => statuses.map((s) => s.failure ?? s.state);
  return { ...fake, controller, statuses, states, click };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const denied = { ok: false, error: { name: 'NotAllowedError', message: 'Permission denied' } };

describe('cameraController', () => {
  it('reports idle, then starting and live after Enable', async () => {
    const t = setup();
    const { session, show } = fakeSession();
    t.click('camera.enable');
    t.starts[0]?.({ ok: true, session });
    await flush();
    expect(t.states()).toEqual(['idle', 'starting', 'live']);
    expect(t.statuses.at(-1)?.actual?.label).toBe('Test cam');
    expect(show).toHaveBeenCalled();
  });

  it('classifies a failure using the permission state', async () => {
    const t = setup({ permission: 'denied' });
    t.click('camera.enable');
    t.starts[0]?.(denied as CameraStart);
    await flush();
    expect(t.states().at(-1)).toBe('denied-by-user');
    expect(t.statuses.at(-1)?.detail).toBe('NotAllowedError: Permission denied');
  });

  it('starts by itself when the permission changes to granted after a denial', async () => {
    const t = setup({ permission: 'denied' });
    t.click('camera.enable');
    t.starts[0]?.(denied as CameraStart);
    await flush();
    t.setPermission('granted');
    expect(t.statuses.at(-1)).toMatchObject({ state: 'starting', auto: true });
    expect(t.starts).toHaveLength(2);
  });

  it('fails at once on an insecure page, without asking the browser', () => {
    const t = setup({ secure: false });
    t.click('camera.enable');
    expect(t.states()).toEqual(['idle', 'starting', 'insecure']);
    expect(t.starts).toHaveLength(0);
  });

  it('an ended track is reported and the session stopped', async () => {
    const t = setup({ permission: 'granted' });
    const fake = fakeSession();
    t.click('camera.enable');
    t.starts[0]?.({ ok: true, session: fake.session });
    await flush();
    fake.end();
    await flush();
    expect(t.states().at(-1)).toBe('ended');
    expect(fake.stop).toHaveBeenCalled();
  });

  it('Use the mouse stops the camera and reports off', async () => {
    const t = setup();
    const fake = fakeSession();
    t.click('camera.enable');
    t.starts[0]?.({ ok: true, session: fake.session });
    await flush();
    t.click('camera.useMouse');
    expect(t.states().at(-1)).toBe('off');
    expect(fake.stop).toHaveBeenCalled();
  });

  it('a success that arrives after choosing the mouse is stopped at once', async () => {
    const t = setup();
    const fake = fakeSession();
    t.click('camera.enable');
    t.click('camera.useMouse');
    t.starts[0]?.({ ok: true, session: fake.session });
    await flush();
    expect(fake.stop).toHaveBeenCalled();
    expect(fake.show).not.toHaveBeenCalled();
    expect(t.states().at(-1)).toBe('off');
  });
});
