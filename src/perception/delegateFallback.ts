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

/** The main thread's order: there the GPU is faster, and the CPU always exists. */
export const DELEGATE_ORDER: readonly TrackerDelegate[] = ['GPU', 'CPU'];

/**
 * The hand worker's order (D-068): CPU first. Measured in T4 on Iris Xe, the GPU delegate in a
 * worker detected a hand in 62 ms (against 25–29 ms on the main thread) and its first-visit
 * shader compile still stalled the screen for 0.5–0.7 s; the CPU delegate detected in 34–50 ms
 * with no stall. Re-checked on the reviewer's Mac (AC-15).
 */
export const WORKER_DELEGATE_ORDER: readonly TrackerDelegate[] = ['CPU', 'GPU'];

/** Delegate orders per detection thread. */
export interface DelegateOrders {
  worker: readonly TrackerDelegate[];
  main: readonly TrackerDelegate[];
}

/**
 * The delegate orders for this session: `?delegate=cpu` (or `gpu`) forces one delegate on both
 * threads, for measuring; anything else gives each thread its normal order.
 */
export function delegateOrdersFromQuery(search: string): DelegateOrders {
  const forced = new URLSearchParams(search).get('delegate')?.toUpperCase();
  if (forced === 'CPU' || forced === 'GPU') return { worker: [forced], main: [forced] };
  return { worker: WORKER_DELEGATE_ORDER, main: DELEGATE_ORDER };
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
