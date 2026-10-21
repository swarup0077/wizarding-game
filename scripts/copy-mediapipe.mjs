// Copies MediaPipe's wasm runtime from node_modules into public/mediapipe/wasm/, so the game
// serves it itself and never loads it from a CDN (FR-2). Runs from `postinstall` and again
// from `prebuild`, so a build can never ship without it, even when a host restores a cached
// node_modules. The version is whatever package-lock.json pins, so the wasm always matches
// the MediaPipe JavaScript bundled into the game. Idempotent; takes milliseconds.
//
// Only the classic loaders are copied: `FilesetResolver.forVisionTasks(path)` picks the SIMD
// build, or the no-SIMD build on browsers without wasm SIMD. The `_module_` variant is for
// ES-module loading (a possible Web Worker later, docs/LATER.md) and is left out until used.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'node_modules/@mediapipe/tasks-vision/wasm';
const TARGET = 'public/mediapipe/wasm';
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

if (!existsSync(SOURCE)) {
  console.error(`copy-mediapipe: ${SOURCE} is missing. Run \`npm install\` first.`);
  process.exit(1);
}
mkdirSync(TARGET, { recursive: true });
let bytes = 0;
for (const file of FILES) {
  copyFileSync(join(SOURCE, file), join(TARGET, file));
  bytes += statSync(join(TARGET, file)).size;
}
console.log(`copy-mediapipe: ${FILES.length} files (${(bytes / 1e6).toFixed(1)} MB) → ${TARGET}`);
