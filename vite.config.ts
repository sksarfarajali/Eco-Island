import { defineConfig } from 'vitest/config';

// Relative base so the build works from any static host path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
  },
});
