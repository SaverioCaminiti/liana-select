import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Core tests run in plain Node: no browser, no DOM emulation.
          name: 'core',
          environment: 'node',
          include: ['src/core/**/*.test.ts'],
        },
      },
      {
        test: {
          // Element tests run in a real browser, with real pointer events.
          name: 'browser',
          include: ['src/element/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            viewport: { width: 1000, height: 700 },
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
