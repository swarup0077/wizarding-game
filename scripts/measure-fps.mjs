// Measures render fps (and, for tracking runs, hand tracking) on this machine's real GPU
// and prints Markdown tables for PROGRESS.md.
// No dependencies: Node's built-in fetch and WebSocket drive Chrome's DevTools protocol (D-033).
//
//   npm run build && npm run measure:fps
//   npm run measure:fps -- --seconds 30 --only retina-cap2-drawing --query "demo=loop&handRate=1"
//   npm run measure:fps -- --only native-worker-gpu,native-main-gpu --clip local/clips/hand.y4m
//   npm run measure:fps -- --only native-worker-gpu --fresh-each --seconds 60
//
// Options:
//   --seconds <n>   length of each run after startup (default 20)
//   --only <a,b>    run only these named runs (see RUNS below)
//   --query <q>     extra URL query added to every run (e.g. a spell demo in later tasks)
//   --url <base>    measure an already-running server (or the deployed site) instead of
//                   starting `vite preview` on ./dist
//   --clip <file>   feed this .y4m or .mjpeg to Chrome's fake camera instead of its built-in
//                   test pattern (the private hand-only clip, kept in git-ignored local/)
//   --fresh-each    a new Chrome with a new profile for every run, so each run is a first
//                   visit (cold GPU shader cache): how the first-load freeze is measured
// Environment: CHROME_PATH overrides where Chrome is found.
//
// It opens a visible Chrome window (headless Chrome renders in software, so its fps means
// nothing) with a throwaway profile, and flags that stop Chrome pausing a covered window.
// "Retina" runs use device emulation at 1440×900 CSS px and DPR 2: the reviewer's MacBook
// pixel count (2880×1800) on this GPU (detection still runs on this machine).
// The camera is ALWAYS Chrome's fake device, never the real webcam (D-054): its built-in
// pattern has no hand, so detection runs its palm search every frame (the costly case);
// `--clip` shows a real hand, so detection tracks it. Each page logs fps, frame gaps and our
// work per frame once a second (`?reportFps=1`), plus a tracking line.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, evaluate, killTree, launchChrome, sleep, waitFor } from './devtools.mjs';
import {
  QUALITY_BAR,
  otherLines,
  renderTable,
  summarizeRender,
  summarizeTracking,
  trackingTable,
} from './fps-report.mjs';

const RETINA = { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };
const CAMERA = 'dev=camera&enable=1';
/** Tracking runs press Enable camera 2.5 s after load, so start-up is measured apart from page load. */
const TRACKING_CAMERA = 'dev=camera&enable=2500';
const DRAWING = 'demo=loop&handRate=1';

/** Hand tracking (T4): {screen} × {worker, main thread} × {GPU, CPU}, all drawing continuously. */
const TRACKING_RUNS = ['native', 'retina-cap2'].flatMap((screen) =>
  ['worker', 'main'].flatMap((thread) =>
    ['gpu', 'cpu'].map((delegate) => ({
      name: `${screen}-${thread}-${delegate}`,
      tracking: true,
      retina: screen !== 'native',
      query: [
        screen !== 'native' ? 'dprCap=2' : '',
        TRACKING_CAMERA,
        DRAWING,
        `delegate=${delegate}`,
        thread === 'main' ? 'detector=main' : '',
      ]
        .filter(Boolean)
        .join('&'),
    })),
  ),
);

const RUNS = [
  { name: 'native-idle', query: '' },
  { name: 'native-drawing', query: DRAWING },
  { name: 'retina-cap1.5-idle', retina: true, query: 'dprCap=1.5' },
  { name: 'retina-cap1.5-drawing', retina: true, query: `dprCap=1.5&${DRAWING}` },
  { name: 'retina-cap2-idle', retina: true, query: 'dprCap=2' },
  { name: 'retina-cap2-drawing', retina: true, query: `dprCap=2&${DRAWING}` },
  // The UI kit gallery: every HUD component, filters and animations, over the stage (T2b).
  { name: 'native-ui-gallery', query: 'dev=ui' },
  { name: 'retina-cap2-ui-gallery', retina: true, query: 'dprCap=2&dev=ui' },
  // The webcam preview on the fake camera (T3). Since T4 these also run hand tracking.
  { name: 'native-camera', query: CAMERA },
  { name: 'retina-cap2-camera', retina: true, query: `dprCap=2&${CAMERA}` },
  ...TRACKING_RUNS,
];
const PREVIEW_PORT = 4173;
/** Extra time for tracking runs: the delayed camera start, then the wasm and model load. */
const TRACKING_EXTRA_S = 9;
/** A run with this many seconds fewer report lines than expected is flagged incomplete. */
const INCOMPLETE_SLACK_S = 3;

function parseArgs(argv) {
  const args = { seconds: 20, only: null, query: '', url: null, clip: null, freshEach: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--fresh-each') {
      args.freshEach = true;
      continue;
    }
    const value = argv[++i];
    if (key === '--seconds') args.seconds = Number(value);
    else if (key === '--only') args.only = value.split(',');
    else if (key === '--query') args.query = value;
    else if (key === '--url') args.url = value.replace(/\/$/, '');
    else if (key === '--clip') args.clip = resolve(value);
    else throw new Error(`Unknown option ${key}. See the header of scripts/measure-fps.mjs.`);
  }
  if (args.clip && !existsSync(args.clip)) throw new Error(`No clip at ${args.clip}.`);
  return args;
}

/** One Chrome session: a launched browser and its DevTools connection. */
async function openBrowser(clip) {
  const port = 9400 + Math.floor(Math.random() * 500);
  const chrome = launchChrome(port, clip);
  const devtools = await connect(port);
  return { chrome, ...devtools };
}

async function measureRun(browser, base, run, args) {
  const { send, consoleLines } = browser;
  const query = ['reportFps=1', run.query, args.query].filter(Boolean).join('&');
  const seconds = args.seconds + 3 + (run.tracking ? TRACKING_EXTRA_S : 0);
  process.stdout.write(`Measuring ${run.name} (${seconds} s)... `);
  if (run.retina) await send('Emulation.setDeviceMetricsOverride', RETINA);
  else await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.bringToFront');
  await send('Page.navigate', { url: `${base}/?${query}` });
  // Navigate answers once the new page has committed: lines before this are the old page's.
  await sleep(100);
  consoleLines.length = 0;
  await sleep(seconds * 1000);
  const canvas = await evaluate(
    send,
    `(() => { const c = document.querySelector('canvas'); return c ? c.width + '×' + c.height : '?'; })()`,
  );
  const machine = await evaluate(
    send,
    `(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return { gpu: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: devicePixelRatio, screen: screen.width + '×' + screen.height, chrome: navigator.userAgent.match(/Chrome\\/([\\d.]+)/)?.[1] }; })()`,
  );
  const lines = [...consoleLines];
  const render = summarizeRender(lines);
  const tracking = run.tracking ? summarizeTracking(lines) : null;
  // Chrome stops rendering when the window is minimized or the display sleeps: the page
  // then logs nothing, and a few seconds of data would pass for a whole run.
  const expected = seconds - INCOMPLETE_SLACK_S - 2;
  const got = render?.seconds ?? 0;
  let incomplete = got < expected ? `${run.name} (${got} of ~${expected} s)` : null;
  if (!incomplete && tracking?.stalled) incomplete = `${run.name} (camera stalled)`;
  console.log(
    render
      ? `${render.fpsMean.toFixed(1)} fps${incomplete ? ` — INCOMPLETE: ${got} of ~${expected} s` : ''}`
      : 'no data (was the window minimized or the display asleep?)',
  );
  return {
    result: { run, canvas, render, tracking, other: otherLines(lines) },
    machine,
    incomplete,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runs = RUNS.filter((r) => !args.only || args.only.includes(r.name));
  if (runs.length === 0)
    throw new Error(`No runs match --only. Names: ${RUNS.map((r) => r.name).join(', ')}`);

  let preview = null;
  let base = args.url;
  if (!base) {
    if (!existsSync('dist/index.html'))
      throw new Error('No build found. Run `npm run build` first.');
    base = `http://localhost:${PREVIEW_PORT}`;
    const { spawn } = await import('node:child_process');
    // Start Vite's own script with this Node: no shell, so no argument-escaping pitfalls.
    preview = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      { stdio: 'ignore', detached: process.platform !== 'win32' },
    );
    await waitFor(base, 'vite preview');
  }

  let browser = null;
  const cleanup = () => {
    killTree(browser?.chrome);
    killTree(preview);
  };
  process.on('exit', cleanup);

  const results = [];
  const incomplete = [];
  let machine = null;
  for (const run of runs) {
    if (!browser || args.freshEach) {
      if (browser) {
        browser.close();
        killTree(browser.chrome);
      }
      browser = await openBrowser(args.clip);
    }
    const measured = await measureRun(browser, base, run, args);
    results.push(measured.result);
    machine ??= measured.machine;
    if (measured.incomplete) incomplete.push(measured.incomplete);
  }
  browser?.close();
  cleanup();

  const camera = args.clip ? `the clip ${args.clip}` : "Chrome's built-in fake camera (no hand)";
  const profile = args.freshEach ? 'a fresh profile per run' : 'one profile for all runs';
  console.log(
    `\nMachine: ${machine?.gpu}; Chrome ${machine?.chrome}; screen ${machine?.screen} CSS px at DPR ${machine?.dpr}. ${args.seconds} s per run after startup; ${profile}. Camera: ${camera}.\n`,
  );
  console.log(renderTable(results));
  if (results.some((r) => r.tracking)) {
    console.log(`\n${trackingTable(results)}`);
    const { minFps, maxLatePerSecond, maxGapMs } = QUALITY_BAR;
    console.log(
      `\nBar (NFR-1 / AC-2): render ≥ ${minFps} fps, ≤ ${maxLatePerSecond} late frame (> 25 ms) per s, no real gap > ${maxGapMs} ms; start-up gap ≤ ${maxGapMs} ms.`,
    );
  }
  for (const { run, other } of results) {
    if (other.length === 0) continue;
    console.log(`\nOther console lines in ${run.name}:`);
    for (const line of other) console.log(`  ${line}`);
  }
  if (incomplete.length > 0) {
    console.log(
      `\nINCOMPLETE runs (the page stopped rendering, or Chrome's fake camera stalled; keep the ` +
        `display awake and the window unminimized, then measure them again): ${incomplete.join(', ')}`,
    );
    process.exit(2);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(`measure-fps failed: ${error.message}`);
  process.exit(1);
});
