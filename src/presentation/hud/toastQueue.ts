import type { EventMap } from '../../core/events';

// Which toasts are on screen (FR-20). Pure: the toast view asks it what to show and when to
// take a note away, and keeps only the DOM work for itself.

/** One message to show, as it arrives on `system:message`. */
export type ToastSpec = EventMap['system:message'];

/** A toast on screen. */
export interface Toast extends ToastSpec {
  id: number;
  /** How long it stays from the moment it was (re)shown. */
  lifetimeMs: number;
}

/** What a push did. */
export interface ToastPush {
  toast: Toast;
  /** The oldest toast, taken away to make room; null if there was room. */
  evicted: Toast | null;
  /** True when an identical toast was already showing and was refreshed instead. */
  refreshed: boolean;
}

/** The queue's limits. */
export interface ToastQueueOptions {
  max: number;
  lifetimeMs: Record<ToastSpec['level'], number>;
}

/** The toast queue. */
export interface ToastQueue {
  push(spec: ToastSpec): ToastPush;
  /** Takes a toast away (its time ran out). Returns false if it was already gone. */
  remove(id: number): boolean;
  /** The toasts on screen, oldest first. */
  visible(): readonly Toast[];
}

const sameMessage = (a: ToastSpec, b: ToastSpec): boolean =>
  a.level === b.level && a.text === b.text && a.action?.id === b.action?.id;

/** Creates a queue that shows at most `max` toasts, dropping the oldest for a new one. */
export function createToastQueue(options: ToastQueueOptions): ToastQueue {
  const shown: Toast[] = [];
  let nextId = 1;

  return {
    push(spec) {
      const existing = shown.find((t) => sameMessage(t, spec));
      if (existing) return { toast: existing, evicted: null, refreshed: true };
      const evicted = shown.length >= options.max ? (shown.shift() ?? null) : null;
      const toast: Toast = { ...spec, id: nextId++, lifetimeMs: options.lifetimeMs[spec.level] };
      shown.push(toast);
      return { toast, evicted, refreshed: false };
    },

    remove(id) {
      const index = shown.findIndex((t) => t.id === id);
      if (index < 0) return false;
      shown.splice(index, 1);
      return true;
    },

    visible: () => shown,
  };
}
