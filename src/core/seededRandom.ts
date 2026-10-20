/** A random source returning numbers in [0, 1). */
export type RandomSource = () => number;

/**
 * Creates a deterministic random source (mulberry32). The same seed always gives
 * the same sequence, so procedural art looks identical on every load and machine.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
