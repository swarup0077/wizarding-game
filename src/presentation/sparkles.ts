import { SPARKLES } from '../config/tuning';
import type { RandomSource } from '../core/seededRandom';
import type { Vec2 } from '../core/types';
import type { ParticleInit } from './particles';

const lerp = (a: number, b: number, m: number): number => a + (b - a) * m;

/** How many sparkles to emit for `distance` travelled at `energy`, carrying fractions over. */
export function sparkleCount(
  distance: number,
  energy: number,
  carry: number,
): { count: number; carry: number } {
  const total = carry + distance * lerp(SPARKLES.perUnitCalm, SPARKLES.perUnitEnergetic, energy);
  const count = Math.floor(total);
  return { count, carry: total - count };
}

/**
 * A new sparkle near `at`: drifting in a random direction, faster, bigger and
 * whiter when the stroke is energetic, slow and lazy when it is calm.
 */
export function sparkleInit(at: Vec2, energy: number, random: RandomSource): ParticleInit {
  const angle = random() * Math.PI * 2;
  const speed =
    lerp(SPARKLES.speedCalm, SPARKLES.speedEnergetic, energy) * (0.35 + 0.65 * random());
  const scatter = 0.004 * (1 + energy);
  return {
    x: at.x + (random() - 0.5) * scatter,
    y: at.y + (random() - 0.5) * scatter,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    lifeMs: lerp(SPARKLES.lifeMinMs, SPARKLES.lifeMaxMs, random()),
    size: lerp(SPARKLES.sizeMin, SPARKLES.sizeMax, random()) * (1 + 0.3 * energy),
    warmth: random() * (1 - 0.5 * energy),
    phase: random() * Math.PI * 2,
  };
}

/** Sparkle brightness flicker at age `ageMs`: between 1 − depth and 1. */
export function twinkle(ageMs: number, phase: number): number {
  const wave = 0.5 + 0.5 * Math.sin(phase + (ageMs / 1000) * SPARKLES.twinkleHz * Math.PI * 2);
  return 1 - SPARKLES.twinkleDepth * wave;
}
