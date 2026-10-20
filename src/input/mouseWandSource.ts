import { INPUT } from '../config/tuning';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { Vec2 } from '../core/types';
import { createRateSampler } from './handRateSampler';
import type { WandSample, WandSource } from './wandSource';

/** The parts of a DOM element the mouse source uses (a fake in tests). */
export interface PointerTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  setPointerCapture(pointerId: number): void;
}

/** Shared dev switch: when on, input is downsampled to the hand-tracking rate. */
export interface HandRatePreview {
  enabled: boolean;
}

/** What the mouse source needs. */
export interface MouseWandSourceOptions {
  target: PointerTarget;
  bus: EventBus<EventMap>;
  /** Client (CSS pixel) coordinates → normalized stage point. */
  toNormalized: (clientX: number, clientY: number) => Vec2;
  handRate: HandRatePreview;
  /** Called when a stroke starts and ends (used to block text selection). */
  onDrawingChange?: (drawing: boolean) => void;
}

const LEFT_BUTTON = 0;

/**
 * The mouse as a wand (FR-6): holding the left button is the pinch, moving is the
 * wand. Uses Pointer Events with pointer capture, so a stroke continues even if the
 * cursor leaves the window, and coalesced events, so fast strokes keep every sample.
 */
export function createMouseWandSource(options: MouseWandSourceOptions): WandSource {
  const { target, bus, toNormalized, handRate, onDrawingChange } = options;
  const sampler = createRateSampler(INPUT.handRateHz);
  let activePointer: number | null = null;
  let lastSample: WandSample | null = null;

  const sampleOf = (e: PointerEvent): WandSample => {
    lastSample = { p: toNormalized(e.clientX, e.clientY), t: e.timeStamp };
    return lastSample;
  };

  const emitMove = (s: WandSample): void =>
    bus.emit('wand:move', { p: s.p, t: s.t, source: 'mouse' });

  const offer = (s: WandSample): void => {
    if (!handRate.enabled) return emitMove(s);
    const due = sampler.offer(s);
    if (due) emitMove(due);
  };

  const endStroke = (e: PointerEvent): void => {
    if (activePointer === null || e.pointerId !== activePointer) return;
    activePointer = null;
    if (handRate.enabled) {
      const pending = sampler.flush();
      if (pending) emitMove(pending);
    }
    const s = sampleOf(e);
    bus.emit('wand:pinchEnd', { p: s.p, t: s.t });
    onDrawingChange?.(false);
  };

  const listeners: Record<string, (event: Event) => void> = {
    pointerdown: (event) => {
      const e = event as PointerEvent;
      if (e.button !== LEFT_BUTTON || !e.isPrimary || activePointer !== null) return;
      e.preventDefault(); // no text selection or drag start
      activePointer = e.pointerId;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail if the pointer is already gone; the stroke still works.
      }
      const s = sampleOf(e);
      sampler.reset(s.t);
      bus.emit('wand:pinchStart', { p: s.p, t: s.t });
      onDrawingChange?.(true);
    },
    pointermove: (event) => {
      const e = event as PointerEvent;
      if (!e.isPrimary) return;
      // Chrome merges fast moves into one event per frame; the originals are kept here.
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const sample of coalesced.length > 0 ? coalesced : [e]) offer(sampleOf(sample));
    },
    pointerup: (event) => endStroke(event as PointerEvent),
    pointercancel: (event) => endStroke(event as PointerEvent),
    lostpointercapture: (event) => endStroke(event as PointerEvent),
    contextmenu: (event) => event.preventDefault(),
  };

  return {
    start() {
      for (const [type, listener] of Object.entries(listeners))
        target.addEventListener(type, listener);
    },
    stop() {
      for (const [type, listener] of Object.entries(listeners))
        target.removeEventListener(type, listener);
      // Never leave a stroke open: end it where the wand was last seen.
      if (activePointer !== null && lastSample) {
        bus.emit('wand:pinchEnd', { p: lastSample.p, t: lastSample.t });
        onDrawingChange?.(false);
      }
      activePointer = null;
    },
  };
}
