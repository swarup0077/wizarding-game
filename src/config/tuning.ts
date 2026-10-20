// Every tunable number in the game. No magic numbers elsewhere (CLAUDE.md).
// The numbers live in one file per layer under ./tuning/; this file re-exports them all,
// so code imports from one place: `import { TRAIL } from '../config/tuning'`.
// Distances are in square units (1 = stage height) unless a name says otherwise.
// Values marked "initial guess" are not given by the spec and get tuned in the named task.
// Per-spell numbers (ideal durations, rotation tolerances) are spell data in spells.ts.

export * from './tuning/input';
export * from './tuning/perception';
export * from './tuning/recognition';
export * from './tuning/presentation';
export * from './tuning/scenes';
export * from './tuning/dev';
