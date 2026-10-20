import { describe, expect, it } from 'vitest';
import {
  type CameraErrorContext,
  classifyCameraError,
  classifyEnded,
  errorDetail,
  errorInfo,
  shouldRetryWithoutConstraints,
} from './cameraErrors';

const ok: CameraErrorContext = { permission: 'prompt', secure: true, hasMediaDevices: true };
const err = (name: string, message = '') => ({ name, message });

describe('classifyCameraError', () => {
  it('reports an insecure page before anything else', () => {
    expect(classifyCameraError(null, { ...ok, secure: false, hasMediaDevices: false })).toBe(
      'insecure',
    );
    expect(classifyCameraError(err('NotFoundError'), { ...ok, secure: false })).toBe('insecure');
  });

  it('reports a browser with no camera API', () => {
    expect(classifyCameraError(null, { ...ok, hasMediaDevices: false })).toBe('unsupported');
  });

  it('finds nothing wrong before the request when the context is fine', () => {
    expect(classifyCameraError(null, ok)).toBeNull();
  });

  describe('NotAllowedError', () => {
    it('is "blocked by the system" when Chrome says so (macOS privacy settings)', () => {
      const e = err('NotAllowedError', 'Permission denied by system');
      expect(classifyCameraError(e, ok)).toBe('denied-by-system');
      expect(classifyCameraError(e, { ...ok, permission: 'denied' })).toBe('denied-by-system');
    });

    it('is "you clicked Block" when the site permission is denied', () => {
      const e = err('NotAllowedError', 'Permission denied');
      expect(classifyCameraError(e, { ...ok, permission: 'denied' })).toBe('denied-by-user');
    });

    it('is "blocked by the system" when the site is allowed but the request still fails', () => {
      const e = err('NotAllowedError', 'Permission denied');
      expect(classifyCameraError(e, { ...ok, permission: 'granted' })).toBe('denied-by-system');
    });

    it('is "dismissed" when the prompt was closed without an answer', () => {
      const e = err('NotAllowedError', 'Permission dismissed');
      expect(classifyCameraError(e, ok)).toBe('dismissed');
    });

    it('falls back to "you clicked Block" when the permission is unknown', () => {
      const e = err('NotAllowedError', 'Permission denied');
      expect(classifyCameraError(e, { ...ok, permission: 'unknown' })).toBe('denied-by-user');
      expect(classifyCameraError(e, ok)).toBe('denied-by-user');
    });
  });

  it('maps the other getUserMedia errors', () => {
    expect(classifyCameraError(err('NotFoundError'), ok)).toBe('not-found');
    expect(classifyCameraError(err('NotReadableError', 'Could not start video source'), ok)).toBe(
      'in-use',
    );
    expect(classifyCameraError(err('AbortError'), ok)).toBe('aborted');
  });

  it('maps anything else to unknown', () => {
    for (const name of ['SecurityError', 'TypeError', 'OverconstrainedError', 'Error', 'Weird'])
      expect(classifyCameraError(err(name), ok)).toBe('unknown');
  });
});

describe('helpers', () => {
  it('retries without constraints only for OverconstrainedError', () => {
    expect(shouldRetryWithoutConstraints(err('OverconstrainedError'))).toBe(true);
    expect(shouldRetryWithoutConstraints(err('NotFoundError'))).toBe(false);
  });

  it('treats an ended track as revoked access when the permission is now denied', () => {
    expect(classifyEnded('denied')).toBe('denied-by-user');
    expect(classifyEnded('granted')).toBe('ended');
    expect(classifyEnded('unknown')).toBe('ended');
  });

  it('reads name and message from anything thrown', () => {
    expect(errorInfo(new DOMException('Permission denied', 'NotAllowedError'))).toEqual(
      err('NotAllowedError', 'Permission denied'),
    );
    expect(errorInfo(new TypeError('bad'))).toEqual(err('TypeError', 'bad'));
    expect(errorInfo('oops')).toEqual(err('Error', 'oops'));
    expect(errorInfo({ name: 42 })).toEqual(err('Error', ''));
  });

  it('formats the detail line', () => {
    expect(errorDetail(err('NotReadableError', 'Could not start'))).toBe(
      'NotReadableError: Could not start',
    );
    expect(errorDetail(err('AbortError'))).toBe('AbortError');
  });
});
