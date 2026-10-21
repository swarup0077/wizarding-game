// Downloads the hand landmark model once (FR-2). The file is then committed (D-022), so
// builds and deploys never download anything. Run it again only to change the model:
//
//   npm run fetch:model             (refuses to overwrite an existing file)
//   npm run fetch:model -- --force
//
// The URL is the versioned float16 model ("/1/"), so a rerun gets the same bytes. The
// official guide links ".../float16/latest/...", which served the identical file (same size
// and MD5) when this was written. The size and SHA-256 it prints go into docs/PROGRESS.md.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const URL_V1 =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const TARGET = 'public/models/hand_landmarker.task';

const force = process.argv.includes('--force');
if (existsSync(TARGET) && !force) {
  console.error(`fetch-model: ${TARGET} already exists. Pass --force to download it again.`);
  process.exit(1);
}

const response = await fetch(URL_V1);
if (!response.ok) {
  console.error(`fetch-model: download failed (HTTP ${response.status}) from ${URL_V1}`);
  process.exit(1);
}
const bytes = new Uint8Array(await response.arrayBuffer());
const expected = Number(response.headers.get('content-length'));
if (expected && bytes.length !== expected) {
  console.error(`fetch-model: got ${bytes.length} bytes, expected ${expected}. Try again.`);
  process.exit(1);
}
mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
console.log(`fetch-model: ${TARGET}\n  ${bytes.length} bytes\n  sha256 ${sha256}`);
