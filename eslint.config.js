import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import lit from 'eslint-plugin-lit';
import wc from 'eslint-plugin-wc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dist-site/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Tooling files are not part of tsconfig.json; type-check them with
          // the Node config instead.
          allowDefaultProject: [
            'eslint.config.js',
            'vite.config.ts',
            'vite.site.config.ts',
            'vitest.config.ts',
          ],
          defaultProject: 'tsconfig.node.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/element/**/*.ts', 'src/index.ts', 'demo/**/*.ts', 'site/**/*.ts'],
    ...lit.configs['flat/recommended'],
  },
  {
    files: ['src/element/**/*.ts', 'src/index.ts', 'demo/**/*.ts', 'site/**/*.ts'],
    ...wc.configs['flat/recommended'],
  },
  {
    // Keep the headless core independent of Lit and of the element wrapper.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lit', 'lit/*', '@lit/*'],
              message: 'The core must not depend on Lit.',
            },
            {
              group: ['**/element', '**/element/*'],
              message: 'The core must not depend on the element wrapper.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  prettier,
);
