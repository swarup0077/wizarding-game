import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Give tests the real text of stylesheets (theme contrast and token checks read them).
    css: true,
  },
});
