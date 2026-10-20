import type { CameraFailureKind } from '../core/types';

// Turns a failed camera request into one kind of failure (FR-1). Pure, so every case is
// tested without a browser. The wording for each kind lives in presentation (cameraCopy).
//
// NotAllowedError covers three different situations, told apart like this:
// - Chrome's own message says "by system" when the operating system blocks it (macOS
//   System Settings → Privacy & Security → Camera has Chrome switched off).
// - Chrome says "dismissed" when the permission prompt was closed without an answer.
// - Otherwise the Permissions API decides: `denied` means the player (or an earlier visit)
//   chose Block. `granted` means the site is allowed, so something below Chrome refused.

/** The camera permission as the Permissions API reports it; `unknown` where it can't. */
export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/** The name and message of a thrown error (a DOMException from getUserMedia, usually). */
export interface CameraErrorInfo {
  name: string;
  message: string;
}

/** What else is known when a request fails. */
export interface CameraErrorContext {
  permission: CameraPermission;
  /** `window.isSecureContext`: camera access needs https:// or localhost. */
  secure: boolean;
  /** Whether `navigator.mediaDevices.getUserMedia` exists at all. */
  hasMediaDevices: boolean;
}

/** Reads `name` and `message` from anything thrown, without trusting its type. */
export function errorInfo(error: unknown): CameraErrorInfo {
  if (typeof error === 'object' && error !== null) {
    const { name, message } = error as { name?: unknown; message?: unknown };
    return {
      name: typeof name === 'string' && name ? name : 'Error',
      message: typeof message === 'string' ? message : '',
    };
  }
  return { name: 'Error', message: String(error) };
}

/** True for the one error a retry without constraints can fix. */
export function shouldRetryWithoutConstraints(error: CameraErrorInfo): boolean {
  return error.name === 'OverconstrainedError';
}

/**
 * Classifies a camera failure. Pass `error: null` before calling getUserMedia, to check
 * only the context (insecure page, no camera API).
 */
export function classifyCameraError(
  error: CameraErrorInfo | null,
  context: CameraErrorContext,
): CameraFailureKind | null {
  if (!context.secure) return 'insecure';
  if (!context.hasMediaDevices) return 'unsupported';
  if (!error) return null;
  switch (error.name) {
    case 'NotAllowedError':
      return classifyNotAllowed(error.message, context.permission);
    case 'NotFoundError':
      return 'not-found';
    case 'NotReadableError':
      return 'in-use';
    case 'AbortError':
      return 'aborted';
    default:
      return 'unknown';
  }
}

function classifyNotAllowed(message: string, permission: CameraPermission): CameraFailureKind {
  if (/\bby system\b/i.test(message)) return 'denied-by-system';
  if (/\bdismissed\b/i.test(message)) return 'dismissed';
  if (permission === 'granted') return 'denied-by-system';
  return 'denied-by-user';
}

/** Why a running camera stopped: Chrome ends the track when access is revoked, too. */
export function classifyEnded(permission: CameraPermission): CameraFailureKind {
  return permission === 'denied' ? 'denied-by-user' : 'ended';
}

/** The browser's error text for the fine print, e.g. "NotReadableError: Could not start". */
export function errorDetail(error: CameraErrorInfo): string {
  return error.message ? `${error.name}: ${error.message}` : error.name;
}
