// Measures render fps (and, for tracking runs, hand tracking) on this machine's real GPU
// and prints Markdown tables for PROGRESS.md.
// No dependencies: Node's built-in fetch and WebSocket drive Chrome's DevTools protocol (D-033).
//
//   npm run build && npm run measure:fps
//   npm run measure:fps -- --seconds 30 --only retina-cap2-drawing --query "demo=loop&handRate=1"
//   npm run measure:fps -- --only native-tracking,retina-cap2-tracking --clip local/clips/hand.y4m
//
// Options:
//   --seconds <n>   length of each run after startup (default 20)
//   --only <a,b>    run only these named runs (see RUNS below)
//   --query <q>     extra URL query added to every run (e.g. a spell demo in later tasks)
//   --url <base>    measure an already-running server (or the deployed site) instead of
//                   starting `vite preview` on ./dist
//   --clip <file>   feed this .y4m or .mjpeg to Chrome's fake camera instead of its built-in
//                   test pattern (the private hand-only clip, kept in git-ignored local/)
// Environment: CHROME_PATH overrides where Chrome is found.
//
// It opens a visible Chrome window (headless Chrome renders in software, so its fps means
// nothing) with a throwaway profile, and flags that stop Chrome pausing a covered window.
// "Retina" runs use device emulation at 1440×900 CSS px and DPR 2: the reviewer's MacBook
// pixel count (2880×1800) on this GPU (detection still runs on this machine).
// The camera is ALWAYS Chrome's fake device, never the real webcam (D-054): its built-in
// pattern has no hand, so detection runs its palm search every frame (the costly case);
// `--clip` shows a real hand, so detection tracks it. Each page logs fps, its longest frame
// gap and our work per frame once a second (`?reportFps=1`), plus a tracking line.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  otherLines,
  renderTable,
  summarizeRender,
  summarizeTracking,
  trackingTable,
} from './fps-report.mjs';

const RETINA = { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };
const CAMERA = 'dev=camera&enable=1';
const RUNS = [
  { name: 'native-idle', query: '' },
  { name: 'native-drawing', query: 'demo=loop&handRate=1' },
  { name: 'retina-cap1.5-idle', retina: true, query: 'dprCap=1.5' },
  { name: 'retina-cap1.5-drawing', retina: true, query: 'dprCap=1.5&demo=loop&handRate=1' },
  { name: 'retina-cap2-idle', retina: true, query: 'dprCap=2' },
  { name: 'retina-cap2-drawing', retina: true, query: 'dprCap=2&demo=loop&handRate=1' },
  // The UI kit gallery: every HUD component, filters and animations, over the stage (T2b).
  { name: 'native-ui-gallery', query: 'dev=ui' },
  { name: 'retina-cap2-ui-gallery', retina: true, query: 'dprCap=2&dev=ui' },
  // The webcam preview on the fake camera (T3). Since T4 these also run hand tracking.
  { name: 'native-camera', query: CAMERA },
  { name: 'retina-cap2-camera', retina: true, query: `dprCap=2&${CAMERA}` },
  // Hand tracking (T4). The tracker loads after the page, so these runs get extra time.
  { name: 'native-tracking', tracking: true, query: CAMERA },
  { name: 'retina-cap2-tracking', tracking: true, retina: true, query: `dprCap=2&${CAMERA}` },
  {
    name: 'retina-cap2-tracking-drawing',
    tracking: true,
    retina: true,
    query: `dprCap=2&${CAMERA}&demo=loop&handRate=1`,
  },
  { name: 'native-tracking-cpu', tracking: true, query: `${CAMERA}&delegate=cpu` },
  {
    name: 'retina-cap2-tracking-cpu',
    tracking: true,
    retina: true,
    query: `dprCap=2&${CAMERA}&delegate=cpu`,
  },
];
const PREVIEW_PORT = 4173;
/** Extra time for tracking runs: the wasm and model load after the page. */
const TRACKING_EXTRA_S = 6;
/** A run with this many seconds fewer report lines than expected is flagged incomplete. */
const INCOMPLETE_SLACK_S = 3;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function parseArgs(argv) {
  const args = { seconds: 20, only: null, query: '', url: null, clip: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = [argv[i], argv[i + 1]];
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

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to the Chrome executable.');
  return found;
}

/** Kills a process and all its children (Chrome and Vite both spawn helpers). */
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32')
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

async function waitFor(url, what) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error(`${what} did not start (${url}).`);
}

/** Text of one console argument (strings, numbers, and errors via their description). */
const argText = (a) => (a.value !== undefined ? String(a.value) : (a.description ?? a.type));

/** A minimal DevTools protocol client: send() with a timeout, plus console line capture. */
async function connect(port) {
  const targets = await (await waitFor(`http://127.0.0.1:${port}/json/list`, 'Chrome')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open) => ws.addEventListener('open', open));
  let id = 0;
  const pending = new Map();
  const consoleLines = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(argText).join(' ');
      const level = msg.params.type;
      consoleLines.push(level === 'info' || level === 'log' ? text : `(${level}) ${text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLines.push(`(exception) ${d.exception?.description ?? d.text}`);
    }
    if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      consoleLines.push(`(${e.source} ${e.level}) ${e.text}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const n = ++id;
      const timer = setTimeout(() => fail(new Error(`DevTools timeout: ${method}`)), 20000);
      pending.set(n, (msg) => {
        clearTimeout(timer);
        done(msg.result ?? {});
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { send, consoleLines, close: () => ws.close() };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result?.value;
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
    // Start Vite's own script with this Node: no shell, so no argument-escaping pitfalls.
    preview = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      { stdio: 'ignore', detached: process.platform !== 'win32' },
    );
    await waitFor(base, 'vite preview');
  }

  const port = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    findChrome(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'wg-fps-'))}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--start-maximized',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      // Always a fake camera (D-054), allowed without a prompt; optionally showing the clip.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      ...(args.clip ? [`--use-file-for-fake-video-capture=${args.clip}`] : []),
      'about:blank',
    ],
    { stdio: 'ignore', detached: process.platform !== 'win32' },
  );
  const cleanup = () => {
    killTree(chrome);
    killTree(preview);
  };
  process.on('exit', cleanup);

  const { send, consoleLines, close } = await connect(port);
  await send('Runtime.enable');
  await send('Log.enable');
  const results = [];
  const incomplete = [];
  let machine = null;
  for (const run of runs) {
    const query = ['reportFps=1', run.query, args.query].filter(Boolean).join('&');
    const seconds = args.seconds + 3 + (run.tracking ? TRACKING_EXTRA_S : 0);
    process.stdout.write(`Measuring ${run.name} (${seconds} s)... `);
    if (run.retina) await send('Emulation.setDeviceMetricsOverride', RETINA);
    else await send('Emulation.clearDeviceMetricsOverride');
    await send('Page.bringToFront');
    consoleLines.length = 0;
    await send('Page.navigate', { url: `${base}/?${query}` });
    await sleep(seconds * 1000);
    const canvas = await evaluate(
      send,
      `(() => { const c = document.querySelector('canvas'); return c ? c.width + '×' + c.height : '?'; })()`,
    );
    machine ??= await evaluate(
      send,
      `(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
        return { gpu: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: devicePixelRatio, screen: screen.width + '×' + screen.height }; })()`,
    );
    const lines = [...consoleLines];
    const render = summarizeRender(lines);
    const tracking = run.tracking ? summarizeTracking(lines) : null;
    results.push({ run, canvas, render, tracking, other: otherLines(lines) });
    // Chrome stops rendering when the window is minimized or the display sleeps: the page
    // then logs nothing, and a few seconds of data would pass for a whole run.
    const expected = seconds - INCOMPLETE_SLACK_S - 2;
    const got = render?.seconds ?? 0;
    if (got < expected) incomplete.push(`${run.name} (${got} of ~${expected} s)`);
    console.log(
      render
        ? `${render.fpsMean.toFixed(1)} fps${got < expected ? ` — INCOMPLETE: ${got} of ~${expected} s` : ''}`
        : 'no data (was the window minimized or the display asleep?)',
    );
  }
  close();
  cleanup();

  const camera = args.clip ? `the clip ${args.clip}` : "Chrome's built-in fake camera (no hand)";
  console.log(
    `\nMachine: ${machine?.gpu}; screen ${machine?.screen} CSS px at DPR ${machine?.dpr}. ${args.seconds} s per run after startup. Camera: ${camera}.\n`,
  );
  console.log(renderTable(results));
  if (results.some((r) => r.tracking)) console.log(`\n${trackingTable(results)}`);
  for (const { run, other } of results) {
    if (other.length === 0) continue;
    console.log(`\nOther console lines in ${run.name}:`);
    for (const line of other) console.log(`  ${line}`);
  }
  if (incomplete.length > 0) {
    console.log(
      `\nINCOMPLETE runs (the page stopped rendering; keep the display awake and the window ` +
        `unminimized, then measure again): ${incomplete.join(', ')}`,
    );
    process.exit(2);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(`measure-fps failed: ${error.message}`);
  process.exit(1);
});
