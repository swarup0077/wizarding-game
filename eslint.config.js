import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Layer boundaries from CLAUDE.md, enforced here so they can't drift.
const layerImportBan = (folders, extra = []) => ({
  patterns: [
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
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
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
        ]),
      ],
    },
  },
  {
    files: ['src/perception/**'],
    rules: {
      'no-restricted-imports': ['error', layerImportBan(['presentation', 'scenes', 'spells'])],
    },
  },
  {
    files: ['src/recognition/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        layerImportBan(
          ['presentation', 'scenes'],
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
