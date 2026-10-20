// Measures render fps on this machine's real GPU and prints a Markdown table for PROGRESS.md.
// No dependencies: Node's built-in fetch and WebSocket drive Chrome's DevTools protocol (D-033).
//
//   npm run build && npm run measure:fps
//   npm run measure:fps -- --seconds 30 --only retina-cap2-drawing --query "demo=loop&handRate=1"
//
// Options:
//   --seconds <n>   length of each run after startup (default 20)
//   --only <a,b>    run only these named runs (see RUNS below)
//   --query <q>     extra URL query added to every run (e.g. a spell demo in later tasks)
//   --url <base>    measure an already-running server (or the deployed site) instead of
//                   starting `vite preview` on ./dist
// Environment: CHROME_PATH overrides where Chrome is found.
//
// It opens a visible Chrome window (headless Chrome renders in software, so its fps means
// nothing) with a throwaway profile, and flags that stop Chrome pausing a covered window.
// "Retina" runs use device emulation at 1440×900 CSS px and DPR 2: the reviewer's MacBook
// pixel count (2880×1800) on this GPU. Camera runs use Chrome's fake camera, so they need
// no webcam and show no prompt. Each page logs fps, its longest frame gap and our
// work per frame once a second (`?reportFps=1`); the first 2 s (startup) are skipped.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RETINA = { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };
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
  // The webcam preview, fed by Chrome's built-in fake camera (T3).
  { name: 'native-camera', query: 'dev=camera&enable=1' },
  { name: 'retina-cap2-camera', retina: true, query: 'dprCap=2&dev=camera&enable=1' },
];
const PREVIEW_PORT = 4173;
const STARTUP_SKIP_MS = 2000;
/** A gap longer than this belongs to the previous page being paused, not to this run. */
const PAUSE_GAP_MS = 5000;
const SLOW_FRAME_MS = 25;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const args = { seconds: 20, only: null, query: '', url: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--seconds') args.seconds = Number(value);
    else if (key === '--only') args.only = value.split(',');
    else if (key === '--query') args.query = value;
    else if (key === '--url') args.url = value.replace(/\/$/, '');
    else throw new Error(`Unknown option ${key}. See the header of scripts/measure-fps.mjs.`);
  }
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

/** A minimal DevTools protocol client: send() with a timeout, plus console line capture. */
async function connect(port) {
  const targets = await (await waitFor(`http://127.0.0.1:${port}/json/list`, 'Chrome')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));
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
      consoleLines.push(msg.params.args.map((a) => a.value).join(' '));
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => reject(new Error(`DevTools timeout: ${method}`)), 20000);
      pending.set(n, (msg) => {
        clearTimeout(timer);
        resolve(msg.result ?? {});
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { send, consoleLines, close: () => ws.close() };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result?.value;
}

function summarize(lines) {
  const rows = lines
    .map((line) => line.match(/\[fps\] ([\d.]+) maxGapMs ([\d.]+) workMs ([\d.]+) at (\d+)/))
    .filter(Boolean)
    .map((m) => ({ fps: +m[1], gap: +m[2], work: +m[3], at: +m[4] }))
    .filter((r) => r.at >= STARTUP_SKIP_MS && r.gap < PAUSE_GAP_MS);
  if (rows.length === 0) return null;
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    seconds: rows.length,
    fpsMean: mean(rows.map((r) => r.fps)),
    fpsMin: Math.min(...rows.map((r) => r.fps)),
    maxGap: Math.max(...rows.map((r) => r.gap)),
    slowSeconds: rows.filter((r) => r.gap > SLOW_FRAME_MS).length,
    workMean: mean(rows.map((r) => r.work)),
    workMax: Math.max(...rows.map((r) => r.work)),
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
      // A synthetic camera that is allowed without a prompt, for the camera runs.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
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
  const results = [];
  let machine = null;
  for (const run of runs) {
    const query = ['reportFps=1', run.query, args.query].filter(Boolean).join('&');
    process.stdout.write(`Measuring ${run.name} (${args.seconds + 3} s)... `);
    if (run.retina) await send('Emulation.setDeviceMetricsOverride', RETINA);
    else await send('Emulation.clearDeviceMetricsOverride');
    await send('Page.bringToFront');
    consoleLines.length = 0;
    await send('Page.navigate', { url: `${base}/?${query}` });
    await sleep((args.seconds + 3) * 1000);
    const canvas = await evaluate(
      send,
      `(() => { const c = document.querySelector('canvas'); return c ? c.width + '×' + c.height : '?'; })()`,
    );
    machine ??= await evaluate(
      send,
      `(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
        return { gpu: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown', dpr: devicePixelRatio, screen: screen.width + '×' + screen.height }; })()`,
    );
    const summary = summarize(consoleLines);
    results.push({ run, canvas, summary });
    console.log(
      summary ? `${summary.fpsMean.toFixed(1)} fps` : 'no data (was the window minimized?)',
    );
  }
  close();
  cleanup();

  const f = (n, digits = 1) => n.toFixed(digits);
  console.log(
    `\nMachine: ${machine?.gpu}; screen ${machine?.screen} CSS px at DPR ${machine?.dpr}. ${args.seconds} s per run after startup.\n`,
  );
  console.log(
    '| Run | Canvas (device px) | fps mean / min | Longest frame gap | Seconds with a gap > 25 ms | Our work per frame (mean / max) |',
  );
  console.log('|---|---|---|---|---|---|');
  for (const { run, canvas, summary: s } of results) {
    if (!s) console.log(`| ${run.name} | ${canvas} | no data | | | |`);
    else
      console.log(
        `| ${run.name} | ${canvas} | ${f(s.fpsMean)} / ${f(s.fpsMin, 0)} | ${f(s.maxGap)} ms | ${s.slowSeconds} of ${s.seconds} | ${f(s.workMean, 2)} / ${f(s.workMax, 2)} ms |`,
      );
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(`measure-fps failed: ${error.message}`);
  process.exit(1);
});
