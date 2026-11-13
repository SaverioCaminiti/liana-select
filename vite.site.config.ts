import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// The documentation site published on GitHub Pages. Unlike the library build,
// it bundles the component and Lit, so that the examples run as they are.
export default defineConfig({
  root: fromRoot('./site'),
  // Relative URLs: the site works under any path, such as /liana-select/.
  base: './',
  build: {
    outDir: fromRoot('./dist-site'),
    emptyOutDir: true,
  },
});
