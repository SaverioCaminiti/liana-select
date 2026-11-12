import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Core tests run in plain Node: no browser, no DOM emulation.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
