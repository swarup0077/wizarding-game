import { defineConfig } from 'vitest/config';
import { handWorkerPlugin } from './vite/handWorkerPlugin.ts';

export default defineConfig({
  // The hand worker is a separate classic build (T4, D-066). Tests never load it.
  plugins: process.env['VITEST'] ? [] : [handWorkerPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Give tests the real text of stylesheets (theme contrast and token checks read them).
    css: true,
  },
});
