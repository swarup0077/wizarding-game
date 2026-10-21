/** Mean and 95th percentile of the most recent samples (detection times, T4). */
export interface RollingStats {
  add(value: number): void;
  /** Samples currently held (at most the window size). */
  count(): number;
  /** Mean of the held samples; 0 when empty. */
  mean(): number;
  /** 95th percentile (nearest rank) of the held samples; 0 when empty. */
  p95(): number;
  clear(): void;
}

/** Creates stats over the last `size` samples. */
export function createRollingStats(size: number): RollingStats {
  const samples: number[] = [];
  let next = 0; // where the next sample goes once the window is full

  return {
    add(value) {
      if (samples.length < size) samples.push(value);
      else samples[next] = value;
      next = (next + 1) % size;
    },
    count: () => samples.length,
    mean() {
      if (samples.length === 0) return 0;
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    },
    p95() {
      if (samples.length === 0) return 0;
      // Nearest rank: the smallest sample with at least 95% of samples at or below it.
      // A sort per read is fine: the overlay reads a few times a second, over ~120 samples.
      const sorted = [...samples].sort((a, b) => a - b);
      const rank = Math.ceil(0.95 * sorted.length) - 1;
      return sorted[Math.max(0, rank)] ?? 0;
    },
    clear() {
      samples.length = 0;
      next = 0;
    },
  };
}
