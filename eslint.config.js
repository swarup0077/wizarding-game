import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Tuning numbers are imported from the `config/tuning` index, never from its layer files,
// so moving a number between files never breaks an import (CLAUDE.md).
const tuningIndexOnly = {
  group: ['**/config/tuning/*'],
  message: "Import tuning numbers from 'config/tuning' (the index), not its layer files.",
};

// Layer boundaries from CLAUDE.md, enforced here so they can't drift.
// Every per-folder rule repeats the tuning rule, because a later rule replaces an earlier one.
const layerImportBan = (folders, extra = []) => ({
  patterns: [
    tuningIndexOnly,
    ...folders.map((folder) => ({
      group: [`**/${folder}`, `**/${folder}/**`],
      message: `This layer must not import from ${folder} (CLAUDE.md layer boundaries).`,
    })),
    ...extra,
  ],
});

export default tseslint.config(
  { ignores: ['dist/**', 'public/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', layerImportBan([])],
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },
  {
    // Build tools require a default export from their config files.
    files: ['*.config.ts', '*.config.js'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Node scripts (plain JavaScript, run with `node`). Globals listed by hand: no extra package.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
      },
    },
  },
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        layerImportBan([
          'input',
          'perception',
          'recognition',
          'spells',
          'scenes',
          'presentation',
          'dev',
          'settings',
          'ui',
        ]),
      ],
    },
  },
  {
    files: ['src/perception/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        layerImportBan(['presentation', 'scenes', 'spells', 'ui']),
      ],
    },
  },
  {
    files: ['src/recognition/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        layerImportBan(
          ['presentation', 'scenes', 'ui'],
          [
            {
              group: ['**/spells/effectRegistry', '**/spells/effectRegistry.*'],
              message: 'Recognition never knows what a spell does (CLAUDE.md layer boundaries).',
            },
          ],
        ),
      ],
    },
  },
  {
    files: ['src/scenes/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        layerImportBan(
          [],
          [
            {
              group: [
                '@mediapipe/*',
                '**/perception/handTracker',
                '**/perception/handTracker.*',
                '**/perception/speechListener',
                '**/perception/speechListener.*',
              ],
              message:
                'Scenes never call MediaPipe or the speech API (CLAUDE.md layer boundaries).',
            },
          ],
        ),
      ],
      'no-restricted-globals': [
        'error',
        { name: 'SpeechRecognition', message: 'Scenes never call the speech API.' },
        { name: 'webkitSpeechRecognition', message: 'Scenes never call the speech API.' },
      ],
    },
  },
  prettier,
);
