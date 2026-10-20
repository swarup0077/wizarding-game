import type { Tier } from '../core/types';

/** A cast's grade on the result card (FR-20). */
export type Grade = 'O' | 'E' | 'A' | 'P';

/** The word shown under each grade letter. */
export const GRADE_WORDS: Readonly<Record<Grade, string>> = {
  O: 'Outstanding',
  E: 'Exceeds Expectations',
  A: 'Acceptable',
  P: 'Poor',
};

const BY_TIER: Readonly<Record<Tier, Grade>> = { strong: 'O', normal: 'E', weak: 'A' };

/** The grade for a successful cast. Spell code keeps tiers; grades exist only on screen. */
export function gradeForTier(tier: Tier): Grade {
  return BY_TIER[tier];
}

/** The grade for a miscast (any reason). */
export const MISCAST_GRADE: Grade = 'P';
