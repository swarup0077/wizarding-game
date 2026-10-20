import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import { createMouseWandSource, type PointerTarget } from './mouseWandSource';

type FakePointer = Partial<PointerEvent> & { coalesced?: Partial<PointerEvent>[] };

/** A stand-in for the stage element that records listeners and capture calls. */
function fakeTarget() {
  const listeners = new Map<string, (e: Event) => void>();
  const captured: number[] = [];
  const target: PointerTarget = {
    addEventListener: (type, l) => listeners.set(type, l),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture: (id) => captured.push(id),
  };
  const fire = (type: string, init: FakePointer = {}) => {
    const event = {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
      preventDefault: vi.fn(),
      getCoalescedEvents: () => (init.coalesced ?? []) as PointerEvent[],
      ...init,
    };
    listeners.get(type)?.(event as unknown as Event);
    return event;
  };
  return { target, fire, listeners, captured };
}

function setup(handRate = false) {
  const bus = createEventBus<EventMap>();
  const log: string[] = [];
  const moves: EventMap['wand:move'][] = [];
  bus.on('wand:move', (e) => {
    log.push('move');
    moves.push(e);
  });
  bus.on('wand:pinchStart', () => log.push('pinchStart'));
  bus.on('wand:pinchEnd', () => log.push('pinchEnd'));
  const fake = fakeTarget();
  const drawing: boolean[] = [];
  const source = createMouseWandSource({
    target: fake.target,
    bus,
    handRate: { enabled: handRate },
    toNormalized: (x, y) => ({ x: x / 100, y: y / 100 }),
    onDrawingChange: (d) => drawing.push(d),
  });
  source.start();
  return { ...fake, source, log, moves, drawing };
}

describe('mouseWandSource', () => {
  it('turns press, move, release into pinchStart, move, pinchEnd', () => {
    const { fire, log, captured, drawing } = setup();
    fire('pointerdown', { clientX: 10, clientY: 20, timeStamp: 5 });
    fire('pointermove', { clientX: 30, clientY: 40, timeStamp: 10 });
    fire('pointerup', { clientX: 30, clientY: 40, timeStamp: 15 });
    expect(log).toEqual(['pinchStart', 'move', 'pinchEnd']);
    expect(captured).toEqual([1]);
    expect(drawing).toEqual([true, false]);
  });

  it('emits normalized points tagged as mouse, with event timestamps', () => {
    const { fire, moves } = setup();
    fire('pointermove', { clientX: 50, clientY: 25, timeStamp: 123 });
    expect(moves).toEqual([{ p: { x: 0.5, y: 0.25 }, t: 123, source: 'mouse' }]);
  });

  it('emits every coalesced sample in order with its own timestamp', () => {
    const { fire, moves } = setup();
    fire('pointermove', {
      timeStamp: 30,
      coalesced: [
        { clientX: 10, clientY: 0, timeStamp: 10 },
        { clientX: 20, clientY: 0, timeStamp: 20 },
        { clientX: 30, clientY: 0, timeStamp: 30 },
      ],
    });
    expect(moves.map((m) => m.t)).toEqual([10, 20, 30]);
    expect(moves.map((m) => m.p.x)).toEqual([0.1, 0.2, 0.3]);
  });

  it('moving without the button only moves the wand', () => {
    const { fire, log } = setup();
    fire('pointermove', { timeStamp: 1 });
    fire('pointermove', { timeStamp: 2 });
    expect(log).toEqual(['move', 'move']);
  });

  it('ignores the right button and non-primary pointers', () => {
    const { fire, log } = setup();
    fire('pointerdown', { button: 2 });
    fire('pointerdown', { isPrimary: false });
    expect(log).toEqual([]);
  });

  it('ends a stroke exactly once, whichever end event arrives', () => {
    const { fire, log } = setup();
    fire('pointerdown', { timeStamp: 1 });
    fire('pointercancel', { timeStamp: 2 });
    fire('lostpointercapture', { timeStamp: 3 });
    fire('pointerup', { timeStamp: 4 });
    expect(log.filter((e) => e === 'pinchEnd')).toHaveLength(1);
  });

  it('blocks the context menu and the press default (text selection)', () => {
    const { fire } = setup();
    expect(fire('contextmenu').preventDefault).toHaveBeenCalled();
    expect(fire('pointerdown').preventDefault).toHaveBeenCalled();
  });

  it('at hand rate, sends about 30 moves a second and the final position before release', () => {
    const { fire, moves, log } = setup(true);
    fire('pointerdown', { timeStamp: 0 });
    for (let t = 8; t <= 1000; t += 8) fire('pointermove', { clientX: t / 10, timeStamp: t });
    fire('pointerup', { clientX: 100, timeStamp: 1001 });
    expect(moves.length).toBeGreaterThanOrEqual(29);
    expect(moves.length).toBeLessThanOrEqual(32);
    expect(log[log.length - 1]).toBe('pinchEnd');
    expect(moves[moves.length - 1]?.t).toBe(1000);
  });

  it('stop() removes listeners and closes an open stroke', () => {
    const { fire, log, source, listeners } = setup();
    fire('pointerdown', { timeStamp: 1 });
    source.stop();
    expect(log).toEqual(['pinchStart', 'pinchEnd']);
    expect(listeners.size).toBe(0);
  });
});
