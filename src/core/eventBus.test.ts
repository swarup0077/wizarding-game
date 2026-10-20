import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './eventBus';
import type { EventMap } from './events';

describe('eventBus', () => {
  it('delivers the payload to every handler of that type', () => {
    const bus = createEventBus<EventMap>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('hand:found', a);
    bus.on('hand:found', b);

    bus.emit('hand:found', { t: 42 });

    expect(a).toHaveBeenCalledExactlyOnceWith({ t: 42 });
    expect(b).toHaveBeenCalledExactlyOnceWith({ t: 42 });
  });

  it('delivers only to handlers of the emitted type', () => {
    const bus = createEventBus<EventMap>();
    const lost = vi.fn();
    bus.on('hand:lost', lost);

    bus.emit('hand:found', { t: 1 });

    expect(lost).not.toHaveBeenCalled();
  });

  it('does nothing when a type has no handlers', () => {
    const bus = createEventBus<EventMap>();
    expect(() => bus.emit('hand:found', { t: 1 })).not.toThrow();
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus<EventMap>();
    const handler = vi.fn();
    const off = bus.on('hand:found', handler);

    bus.emit('hand:found', { t: 1 });
    off();
    bus.emit('hand:found', { t: 2 });

    expect(handler).toHaveBeenCalledExactlyOnceWith({ t: 1 });
  });

  it('treats a second unsubscribe as harmless', () => {
    const bus = createEventBus<EventMap>();
    const off = bus.on('hand:found', vi.fn());
    off();
    expect(() => off()).not.toThrow();
  });

  it('still reaches later handlers when one unsubscribes during an emit', () => {
    const bus = createEventBus<EventMap>();
    const later = vi.fn();
    const off = bus.on('hand:found', () => off());
    bus.on('hand:found', later);

    bus.emit('hand:found', { t: 1 });

    expect(later).toHaveBeenCalledOnce();
  });

  it('keeps calling other handlers when one throws, and reports the error', () => {
    const onError = vi.fn();
    const bus = createEventBus<EventMap>({ onError });
    const boom = new Error('boom');
    const before = vi.fn();
    const after = vi.fn();
    bus.on('hand:found', before);
    bus.on('hand:found', () => {
      throw boom;
    });
    bus.on('hand:found', after);

    bus.emit('hand:found', { t: 1 });

    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledExactlyOnceWith(boom, 'hand:found');
  });

  it('reports to console.error by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createEventBus<EventMap>();
    bus.on('hand:found', () => {
      throw new Error('boom');
    });

    bus.emit('hand:found', { t: 1 });

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
