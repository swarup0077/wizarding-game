/** One sparkle. Positions in square units, velocities in square units per second. */
export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  size: number;
  /** 0 white-gold … 1 amber. */
  warmth: number;
  /** Phase offset so sparkles don't twinkle in unison. */
  phase: number;
}

/** What a new particle starts with. */
export type ParticleInit = Omit<Particle, 'alive' | 'ageMs'>;

/** Motion settings applied every update. */
export interface ParticlePhysics {
  /** Velocity loss per second (exponential). */
  drag: number;
  /** Upward acceleration (square units per second²). */
  float: number;
}

/** A fixed-size particle pool: objects are created once and reused, never allocated per frame. */
export interface ParticlePool {
  /** Starts a particle in a free slot. Returns false (and drops it) when the pool is full. */
  spawn(init: ParticleInit): boolean;
  /** Ages and moves every live particle; frees the ones that finished. */
  update(dtMs: number, physics: ParticlePhysics): void;
  /** Calls `fn` for each live particle. */
  forEachAlive(fn: (p: Particle) => void): void;
  aliveCount(): number;
  capacity(): number;
}

/** Creates a pool with room for `capacity` particles. */
export function createParticlePool(capacity: number): ParticlePool {
  const slots: Particle[] = Array.from({ length: capacity }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ageMs: 0,
    lifeMs: 1,
    size: 0,
    warmth: 0,
    phase: 0,
  }));
  // Indices of free slots, used as a stack so spawning is O(1).
  const free: number[] = slots.map((_, i) => capacity - 1 - i);
  let alive = 0;

  return {
    spawn(init) {
      const index = free.pop();
      const p = index === undefined ? undefined : slots[index];
      if (!p) return false;
      Object.assign(p, init);
      p.alive = true;
      p.ageMs = 0;
      alive++;
      return true;
    },

    update(dtMs, physics) {
      const dt = dtMs / 1000;
      const keep = Math.exp(-physics.drag * dt);
      slots.forEach((p, i) => {
        if (!p.alive) return;
        p.ageMs += dtMs;
        if (p.ageMs >= p.lifeMs) {
          p.alive = false;
          free.push(i);
          alive--;
          return;
        }
        p.vx *= keep;
        p.vy = p.vy * keep - physics.float * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
    },

    forEachAlive(fn) {
      for (const p of slots) if (p.alive) fn(p);
    },

    aliveCount: () => alive,
    capacity: () => capacity,
  };
}

/**
 * A sparkle's brightness over its life (f = age / life): a quick fade-in, then an
 * ease-out to exactly zero, so it never pops out of existence.
 */
export function sparkleAlpha(f: number): number {
  const c = Math.min(1, Math.max(0, f));
  const fadeIn = Math.min(1, c / 0.08);
  return fadeIn * (1 - c) ** 2;
}

/** A sparkle's size over its life: shrinks to 40% as it fades. */
export function sparkleScale(f: number): number {
  const c = Math.min(1, Math.max(0, f));
  return 1 - 0.6 * c;
}
