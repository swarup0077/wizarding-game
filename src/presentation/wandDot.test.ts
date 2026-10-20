import { describe, expect, it } from 'vitest';
import { WAND_DOT } from '../config/tuning';
import { dotPulse } from './wandDot';

describe('wand dot pulse', () => {
  it('stays within 1 ± depth and repeats every 1/pulseHz seconds', () => {
    const period = 1000 / WAND_DOT.pulseHz;
    for (let t = 0; t < 3000; t += 13) {
      expect(Math.abs(dotPulse(t) - 1)).toBeLessThanOrEqual(WAND_DOT.pulseDepth + 1e-9);
      expect(dotPulse(t + period)).toBeCloseTo(dotPulse(t), 9);
    }
  });
});
