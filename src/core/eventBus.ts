import type { EventMap } from './events';

/** A function that receives one event's payload. */
export type Handler<P> = (payload: P) => void;

/** Typed publish/subscribe. The only way layers talk to each other. */
export interface EventBus<M extends object = EventMap> {
  /** Subscribes to one event type. Returns a function that unsubscribes. */
  on<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void;
  /** Delivers a payload synchronously to every current subscriber of `type`. */
  emit<K extends keyof M>(type: K, payload: M[K]): void;
}

/** Options for {@link createEventBus}. */
export interface EventBusOptions {
  /** Called when a handler throws. Defaults to `console.error`. */
  onError?: (error: unknown, type: PropertyKey) => void;
}

const reportToConsole = (error: unknown, type: PropertyKey): void => {
  console.error(`Event handler for "${String(type)}" threw:`, error);
};

/** Creates an event bus. A throwing handler is reported and never stops the others. */
export function createEventBus<M extends object = EventMap>(
  options: EventBusOptions = {},
): EventBus<M> {
  const onError = options.onError ?? reportToConsole;
  // Handlers are stored untyped per event; `on` and `emit` keep the pairing type-safe.
  const handlers = new Map<keyof M, Set<Handler<never>>>();

  return {
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },

    emit(type, payload) {
      const set = handlers.get(type);
      if (!set) return;
      // Iterate over a copy, so handlers can unsubscribe (or subscribe) mid-emit safely.
      for (const handler of [...set]) {
        try {
          (handler as Handler<typeof payload>)(payload);
        } catch (error) {
          onError(error, type);
        }
      }
    },
  };
}
