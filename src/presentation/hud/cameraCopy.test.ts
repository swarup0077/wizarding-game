import { describe, expect, it } from 'vitest';
import type { EventMap } from '../../core/events';
import { classifyCameraError } from '../../input/cameraErrors';
import { CAMERA_FAILURE_KINDS, cameraCopy, cameraNotice, isCameraFailureKind } from './cameraCopy';
import type { CameraPermission } from '../../input/cameraErrors';
import type { Platform } from './platform';

const PLATFORMS: Platform[] = ['mac', 'windows', 'other'];
const ok = { secure: true, hasMediaDevices: true };
const words = (
  name: string,
  message: string,
  platform: Platform,
  permission: CameraPermission = 'prompt',
) => {
  const kind = classifyCameraError({ name, message }, { ...ok, permission });
  if (!kind) throw new Error('no kind');
  return cameraCopy(kind, platform);
};

describe('cameraCopy', () => {
  it('has a title and a body for every kind on every platform', () => {
    expect(CAMERA_FAILURE_KINDS).toHaveLength(10);
    for (const kind of CAMERA_FAILURE_KINDS) {
      for (const platform of PLATFORMS) {
        const copy = cameraCopy(kind, platform);
        expect(copy.title.length).toBeGreaterThan(5);
        expect(copy.body.length).toBeGreaterThan(20);
      }
    }
  });

  it('offers Retry everywhere except where it cannot help', () => {
    for (const kind of CAMERA_FAILURE_KINDS) {
      const expected = kind !== 'insecure' && kind !== 'unsupported';
      expect(cameraCopy(kind, 'mac').retry).toBe(expected);
    }
  });

  // The same DOMException name leads to different words depending on who blocked it.
  describe('NotAllowedError, from the DOMException to the words', () => {
    it('"you clicked Block" points at the camera icon in the address bar', () => {
      const copy = words('NotAllowedError', 'Permission denied', 'other', 'denied');
      expect(copy.title).toBe('The camera is blocked');
      expect(copy.body).toContain('camera icon at the right end of the address bar');
    });

    it('macOS "blocked by the system" names System Settings and the Chrome relaunch', () => {
      const copy = words('NotAllowedError', 'Permission denied by system', 'mac');
      expect(copy.title).toBe('Your Mac is keeping the camera from Chrome');
      expect(copy.body).toContain('System Settings → Privacy & Security → Camera');
      expect(copy.body).toContain('Google Chrome');
      expect(copy.body).toContain('reopen Chrome');
    });

    it('Windows "blocked by the system" names the Windows privacy page', () => {
      const copy = words('NotAllowedError', 'Permission denied by system', 'windows');
      expect(copy.body).toContain('Settings → Privacy & security → Camera');
    });

    it('a site that is allowed but still refused counts as the system blocking it', () => {
      const copy = words('NotAllowedError', 'Permission denied', 'mac', 'granted');
      expect(copy.title).toBe('Your Mac is keeping the camera from Chrome');
    });

    it('"you clicked Block" on a Mac also mentions the system setting, just in case', () => {
      const copy = words('NotAllowedError', 'Permission denied', 'mac', 'denied');
      expect(copy.body).toContain('System Settings → Privacy & Security → Camera');
    });

    it('a dismissed prompt says Retry will ask again', () => {
      expect(words('NotAllowedError', 'Permission dismissed', 'mac').body).toContain(
        'Retry to be asked again',
      );
    });
  });

  it('words the other errors with their next step', () => {
    expect(words('NotFoundError', '', 'mac').title).toBe('No camera found');
    const busy = words('NotReadableError', 'Could not start video source', 'windows');
    expect(busy.body).toMatch(/Teams, Zoom/);
    expect(busy.body).toContain('Privacy & security');
    expect(words('NotReadableError', '', 'mac').body).not.toContain('Windows');
    expect(words('AbortError', '', 'mac').body).toContain('Retry');
    expect(words('SecurityError', '', 'mac').title).toBe("The camera didn't start");
    expect(cameraCopy('insecure', 'mac').body).toContain('https://');
    expect(cameraCopy('ended', 'mac').body).toContain('mouse is your wand for now');
  });

  it('recognises failure kinds (dev trigger)', () => {
    expect(isCameraFailureKind('in-use')).toBe(true);
    expect(isCameraFailureKind('nope')).toBe(false);
    expect(isCameraFailureKind(null)).toBe(false);
  });
});

describe('cameraNotice', () => {
  const status = (s: Partial<EventMap['camera:status']>): EventMap['camera:status'] => ({
    state: 'idle',
    t: 0,
    ...s,
  });

  it('tells the player how to draw when the mouse takes over', () => {
    expect(cameraNotice('failed', status({ state: 'off' }))?.text).toContain('left button');
    expect(cameraNotice('off', status({ state: 'off' }))).toBeNull();
  });

  it('confirms an automatic start and an unconstrained retry', () => {
    expect(cameraNotice('failed', status({ state: 'starting', auto: true }))?.text).toBe(
      'Camera allowed. Waking it now.',
    );
    expect(cameraNotice('idle', status({ state: 'starting' }))).toBeNull();
    expect(
      cameraNotice('starting', status({ state: 'live', retriedUnconstrained: true }))?.text,
    ).toContain('using its own');
    expect(cameraNotice('starting', status({ state: 'live' }))).toBeNull();
  });
});
