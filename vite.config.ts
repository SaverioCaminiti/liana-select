import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ command }) =>
  command === 'serve'
    ? {
        // `pnpm dev` serves the demo page.
        root: fromRoot('./demo'),
      }
    : {
        build: {
          lib: {
            entry: {
              'liana-select': fromRoot('./src/index.ts'),
              core: fromRoot('./src/core/index.ts'),
            },
            formats: ['es'],
          },
          rolldownOptions: {
            // Lit is a runtime dependency resolved by the consumer, not bundled.
            external: [/^lit(\/|$)/, /^@lit\//],
          },
          sourcemap: true,
        },
      },
);
