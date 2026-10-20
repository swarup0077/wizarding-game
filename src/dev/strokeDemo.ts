// Dev tool: plays scripted strokes through the same 30 Hz sampler the mouse uses, so the
// trail can be judged and screenshotted without a hand (D-033). Loaded only for `?demo=`.
//   ?demo=circle|zigzag|swish  &speed=slow|fast  &at=0.85   one stroke, frozen at 85%
//   ?demo=loop                                                 every shape, forever
import { INPUT } from '../config/tuning';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { Vec2 } from '../core/types';
import { createRateSampler } from '../input/handRateSampler';
import type { HandRatePreview } from '../input/mouseWandSource';
import type { FrameTime } from '../presentation/canvasStage';
import type { Layer } from '../presentation/layer';
import type { ReleaseOutcome } from '../presentation/trailColors';
import { demoShapes, type DemoShape, pointAlong } from './demoShapes';

/** A running demo: its clock and the layer that feeds strokes in. */
export interface StrokeDemo {
  frameTime: FrameTime;
  /** Add before the trail layer, so each frame's samples exist before the trail draws. */
  layer: Layer;
}

const DURATION_MS = { slow: 1600, fast: 450 } as const;
const HOVER_BEFORE_MS = 250;
const HOVER_AFTER_MS = 350;
/** Mouse-like input rate before the 30 Hz preview downsamples it. */
const SAMPLE_HZ = 120;
const STEP_MS = 1000 / 60;
/** Stroke size in square units, centred on the stage. */
const SIZE = 0.55;

interface Take {
  shape: DemoShape;
  durationMs: number;
  outcome: ReleaseOutcome;
}

/** Minimum-jerk easing: how people move between two points (slow, fast, slow). */
const ease = (u: number): number => u * u * u * (10 - 15 * u + 6 * u * u);

/** Builds the demo from URL parameters, or returns null when `?demo=` is absent or unknown. */
export function createStrokeDemo(
  params: URLSearchParams,
  bus: EventBus<EventMap>,
  handRate: HandRatePreview,
  setReleasePreview: (o: ReleaseOutcome) => void,
): StrokeDemo | null {
  const name = params.get('demo');
  const speed = params.get('speed') === 'fast' ? 'fast' : 'slow';
  const freezeAt = Number(params.get('at') ?? 'NaN');
  const loop = name === 'loop';
  const single = demoShapes.find((s) => s.name === name);
  if (!loop && !single) return null;

  const takes: Take[] = loop
    ? demoShapes.flatMap((shape, i) =>
        (['slow', 'fast'] as const).map((sp, j) => ({
          shape,
          durationMs: DURATION_MS[sp],
          outcome: (['gold', 'grey', 'fade'] as const)[(i + j) % 3] ?? 'fade',
        })),
      )
    : single
      ? [{ shape: single, durationMs: DURATION_MS[speed], outcome: 'gold' }]
      : [];
  const takeLength = (t: Take): number => HOVER_BEFORE_MS + t.durationMs + HOVER_AFTER_MS;
  const cycleMs = takes.reduce((sum, t) => sum + takeLength(t), 0);

  // A stepped clock (one frame = exactly 1/60 s) makes single-shape screenshots repeatable.
  // The loop runs on real time so its fps numbers are real.
  let stepped = 1000;
  let frozen = false;
  const frameTime: FrameTime = loop ? (t) => t : () => (frozen ? stepped : (stepped += STEP_MS));

  const sampler = createRateSampler(INPUT.handRateHz);
  let startedAt: number | null = null;
  let nextSample = 0;
  let pinched = false;

  const emitMove = (p: Vec2, t: number): void => {
    if (!handRate.enabled) return bus.emit('wand:move', { p, t, source: 'mouse' });
    const due = sampler.offer({ p, t });
    if (due) bus.emit('wand:move', { p: due.p, t: due.t, source: 'mouse' });
  };

  /** Where the script is at time `t`: which take, its position and whether it is pinched. */
  const scriptAt = (elapsed: number, aspect: number) => {
    let local = loop ? elapsed % cycleMs : Math.min(elapsed, takeLength(takes[0] as Take) - 1);
    for (const take of takes) {
      const length = takeLength(take);
      if (local >= length) {
        local -= length;
        continue;
      }
      const u = Math.min(1, Math.max(0, (local - HOVER_BEFORE_MS) / take.durationMs));
      const unit = pointAlong(take.shape, ease(u));
      const p = {
        x: (aspect / 2 + (unit.x - 0.5) * SIZE) / aspect,
        y: 0.5 + (unit.y - 0.5) * SIZE,
      };
      return {
        take,
        p,
        progress: u,
        pinched: local >= HOVER_BEFORE_MS && local < HOVER_BEFORE_MS + take.durationMs,
      };
    }
    return null;
  };

  const layer: Layer = {
    update(_dt, now, view) {
      startedAt ??= now;
      if (frozen) return;
      for (; startedAt + nextSample <= now; nextSample += 1000 / SAMPLE_HZ) {
        const t = startedAt + nextSample;
        const state = scriptAt(nextSample, view.aspect);
        if (!state) continue;
        if (state.pinched && !pinched) {
          pinched = true;
          sampler.reset(t);
          setReleasePreview(state.take.outcome);
          bus.emit('wand:pinchStart', { p: state.p, t });
        } else if (!state.pinched && pinched) {
          pinched = false;
          const pending = handRate.enabled ? sampler.flush() : null;
          if (pending) bus.emit('wand:move', { p: pending.p, t: pending.t, source: 'mouse' });
          bus.emit('wand:pinchEnd', { p: state.p, t });
        } else emitMove(state.p, t);
        if (!loop && Number.isFinite(freezeAt) && state.pinched && state.progress >= freezeAt) {
          frozen = true;
          return;
        }
      }
    },
    render: () => undefined,
  };

  return { frameTime, layer };
}
