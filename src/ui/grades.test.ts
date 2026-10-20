import { describe, expect, it } from 'vitest';
import { GRADE_WORDS, gradeForTier, MISCAST_GRADE } from './grades';

describe('grades (FR-20)', () => {
  it('maps tiers to O, E, A and miscasts to P', () => {
    expect(gradeForTier('strong')).toBe('O');
    expect(gradeForTier('normal')).toBe('E');
    expect(gradeForTier('weak')).toBe('A');
    expect(MISCAST_GRADE).toBe('P');
  });

  it('has a word for every grade', () => {
    expect(GRADE_WORDS).toEqual({
      O: 'Outstanding',
      E: 'Exceeds Expectations',
      A: 'Acceptable',
      P: 'Poor',
    });
  });
});
