import { defineConfig } from 'vitest/config';

// The gesture benchmark (FR-24). Kept out of `npm test` so tests stay fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['bench/**/*.test.ts'],
    passWithNoTests: true,
  },
});
