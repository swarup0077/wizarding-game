import { SPARKLES, TRAIL } from '../config/tuning';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import { createSeededRandom } from '../core/seededRandom';
import type { Vec2 } from '../core/types';
import { createSpriteCache } from './glowSprites';
import type { Layer } from './layer';
import { createParticlePool, sparkleAlpha, sparkleScale } from './particles';
import { sparkleCount, sparkleInit, twinkle } from './sparkles';
import {
  reachableTrailColors,
  type ReleaseOutcome,
  sparkleSpriteColor,
  spriteColor,
} from './trailColors';
import { drawGlow, drawTrail, type TrailStyle } from './trailDraw';
import { buildTrail, energyForSpeed, smoothToward } from './trailModel';
import { DOT_COLOURS, drawWandDot } from './wandDot';
import { createWandTimeline } from './wandTimeline';

/** The wand trail, its sparkles and the idle wand dot (FR-18), driven by `wand:*` events. */
export interface TrailLayer extends Layer {
  /** How strokes end while nothing recognizes gestures yet (dev preview; T7 replaces it). */
  setReleasePreview: (outcome: ReleaseOutcome) => void;
  /** Numbers for the debug overlay. */
  stats(): {
    inputHz: number;
    trailPoints: number;
    particles: number;
    delayMs: number;
    sprites: number;
  };
  dispose(): void;
}

interface Stroke {
  start: number;
  end: number | null;
  outcome: ReleaseOutcome;
  energy: number;
  sparkleCarry: number;
  lastHead: Vec2 | null;
  burstDone: boolean;
}

const SPARKLE_SEED = 7;

/** Creates the layer and subscribes it to the bus. */
export function createTrailLayer(bus: EventBus<EventMap>): TrailLayer {
  const timeline = createWandTimeline();
  const sprites = createSpriteCache();
  const reachable = reachableTrailColors();
  sprites.warm([...reachable.glow, ...DOT_COLOURS], reachable.sparkle);
  const particles = createParticlePool(SPARKLES.cap);
  const random = createSeededRandom(SPARKLE_SEED);
  const strokes: Stroke[] = [];
  let releasePreview: ReleaseOutcome = 'fade';
  let renderNow = 0;
  let aspect = 16 / 9;
  let pointsDrawn = 0;

  const active = (): Stroke | undefined => strokes.find((s) => s.end === null);
  const push = (p: Vec2, t: number): void => timeline.push({ x: p.x, y: p.y, t });

  const offs = [
    bus.on('wand:move', ({ p, t }) => push(p, t)),
    bus.on('wand:pinchStart', ({ p, t }) => {
      push(p, t);
      strokes.push({
        start: t,
        end: null,
        outcome: 'fade',
        energy: 0,
        sparkleCarry: 0,
        lastHead: null,
        burstDone: false,
      });
    }),
    bus.on('wand:pinchEnd', ({ p, t }) => {
      push(p, t);
      const stroke = active();
      if (!stroke) return;
      stroke.end = t;
      stroke.outcome = releasePreview;
    }),
  ];

  const strokeSamples = (s: Stroke) => timeline.between(s.start, s.end ?? Infinity);

  function updateActive(stroke: Stroke, dtMs: number): void {
    const head = timeline.positionAt(renderNow, aspect);
    const before = timeline.positionAt(renderNow - TRAIL.speedWindowMs, aspect);
    if (!head || !before) return;
    const speed = Math.hypot(head.x - before.x, head.y - before.y) / (TRAIL.speedWindowMs / 1000);
    stroke.energy = smoothToward(
      stroke.energy,
      energyForSpeed(speed),
      dtMs,
      TRAIL.energySmoothingMs,
    );

    // Sparkles are emitted per distance travelled, so a still wand doesn't spray.
    const from = stroke.lastHead ?? head;
    const distance = Math.hypot(head.x - from.x, head.y - from.y);
    const { count, carry } = sparkleCount(distance, stroke.energy, stroke.sparkleCarry);
    stroke.sparkleCarry = carry;
    for (let i = 0; i < count; i++) {
      const m = random();
      const at = { x: from.x + (head.x - from.x) * m, y: from.y + (head.y - from.y) * m };
      particles.spawn(sparkleInit(at, stroke.energy, random));
    }
    stroke.lastHead = head;
  }

  /** A gold release throws a burst of sparkles along the whole visible trail. */
  function burst(stroke: Stroke): void {
    stroke.burstDone = true;
    const points = buildTrail(strokeSamples(stroke), renderNow, aspect);
    for (let i = 0; i < SPARKLES.releaseBurst && points.length > 0; i++) {
      const p = points[Math.floor(random() * points.length)];
      if (p) particles.spawn(sparkleInit(p, 0.6, random));
    }
  }

  function styleFor(stroke: Stroke): TrailStyle {
    if (stroke.end === null || stroke.outcome === 'fade') {
      return { energy: stroke.energy, outcome: 'fade', release: 0, boost: 1 };
    }
    const since = Math.max(0, renderNow - stroke.end);
    if (stroke.outcome === 'gold') {
      const r = Math.min(1, since / TRAIL.releaseFlashMs);
      return { energy: stroke.energy, outcome: 'gold', release: 1, boost: 1 + 1.1 * (1 - r) ** 2 };
    }
    const r = Math.min(1, since / TRAIL.greyFadeMs);
    return { energy: 0, outcome: 'grey', release: r, boost: 1 - 0.45 * r };
  }

  return {
    update(dtMs, nowMs, view) {
      aspect = view.aspect;
      renderNow = nowMs - timeline.renderDelayMs();
      for (const stroke of strokes) {
        if (stroke.end === null) updateActive(stroke, dtMs);
        else {
          stroke.energy = smoothToward(stroke.energy, 0, dtMs, TRAIL.energySmoothingMs * 3);
          if (stroke.outcome === 'gold' && !stroke.burstDone && renderNow >= stroke.end)
            burst(stroke);
        }
      }
      // Forget strokes that have fully faded, and samples nothing can draw any more.
      const fadedBefore = renderNow - TRAIL.fadeMs - TRAIL.releaseFlashMs;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const end = strokes[i]?.end;
        if (end !== null && end !== undefined && end < fadedBefore) strokes.splice(i, 1);
      }
      timeline.pruneBefore(renderNow - TRAIL.fadeMs * 3);
      particles.update(dtMs, SPARKLES);
    },

    render(g, view) {
      const unit = view.height;
      g.save();
      g.globalCompositeOperation = 'lighter';
      pointsDrawn = 0;
      for (const stroke of strokes) {
        const points = buildTrail(strokeSamples(stroke), renderNow, aspect);
        pointsDrawn += points.length;
        drawTrail(g, points, unit, styleFor(stroke), sprites);
      }

      particles.forEachAlive((p) => {
        const f = p.ageMs / p.lifeMs;
        const alpha = sparkleAlpha(f) * twinkle(p.ageMs, p.phase);
        drawGlow(
          g,
          sprites.sparkle(sparkleSpriteColor(p.warmth)),
          p.x,
          p.y,
          p.size * sparkleScale(f),
          alpha,
          unit,
        );
      });

      const head = timeline.positionAt(renderNow, aspect);
      const drawing = active();
      if (head && drawing) {
        const energy = drawing.energy;
        const flare = TRAIL.headFlareRadius * (1 + 0.5 * energy);
        drawGlow(
          g,
          sprites.glow(spriteColor(0, energy, 'fade', 0)),
          head.x,
          head.y,
          flare,
          TRAIL.headFlareAlpha,
          unit,
        );
      } else if (head) {
        drawWandDot(g, head, renderNow, unit, sprites, 1);
      }
      g.restore();
    },

    setReleasePreview(outcome) {
      releasePreview = outcome;
    },

    stats: () => ({
      inputHz: timeline.rateHz(),
      trailPoints: pointsDrawn,
      particles: particles.aliveCount(),
      delayMs: timeline.renderDelayMs(),
      sprites: sprites.size(),
    }),

    dispose() {
      for (const off of offs) off();
    },
  };
}
