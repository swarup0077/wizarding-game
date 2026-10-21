import type { TrackerDelegate } from '../core/types';

// GPU first, CPU if the GPU can't (FR-2). Pure: the browser work is passed in as `create`,
// so the order and the error bookkeeping are tested without MediaPipe.

/** A delegate that was tried and failed, with the reason. */
export interface DelegateAttempt {
  delegate: TrackerDelegate;
  error: string;
}

/** The delegate that worked, and any that failed before it. */
export interface DelegateChoice<T> {
  value: T;
  delegate: TrackerDelegate;
  failed: DelegateAttempt[];
}

/** Every delegate failed. */
export class DelegatesFailedError extends Error {
  constructor(readonly attempts: DelegateAttempt[]) {
    super(attempts.map((a) => `${a.delegate}: ${a.error}`).join('; ') || 'No delegate to try.');
    this.name = 'DelegatesFailedError';
  }
}

/** The normal order: the GPU is much faster on most machines, the CPU always exists. */
export const DELEGATE_ORDER: readonly TrackerDelegate[] = ['GPU', 'CPU'];

/**
 * The delegate order for this session: `?delegate=cpu` (or `gpu`) forces one delegate, for
 * measuring the fallback path; anything else gives the normal order.
 */
export function delegateOrderFromQuery(search: string): readonly TrackerDelegate[] {
  const forced = new URLSearchParams(search).get('delegate')?.toUpperCase();
  return forced === 'CPU' || forced === 'GPU' ? [forced] : DELEGATE_ORDER;
}

/** A readable reason from anything thrown. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/** Tries each delegate in `order` until `create` succeeds. Throws DelegatesFailedError if none does. */
export async function createWithFallback<T>(
  order: readonly TrackerDelegate[],
  create: (delegate: TrackerDelegate) => Promise<T>,
): Promise<DelegateChoice<T>> {
  const failed: DelegateAttempt[] = [];
  for (const delegate of order) {
    try {
      return { value: await create(delegate), delegate, failed };
    } catch (error) {
      failed.push({ delegate, error: errorText(error) });
    }
  }
  throw new DelegatesFailedError(failed);
}

/** The delegate to fall back to after `current` fails at runtime, or null if none is left. */
export function nextDelegate(
  order: readonly TrackerDelegate[],
  current: TrackerDelegate,
): TrackerDelegate | null {
  const i = order.indexOf(current);
  return i >= 0 ? (order[i + 1] ?? null) : null;
}
