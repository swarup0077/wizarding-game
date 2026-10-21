// Starting Chrome and talking to it over the DevTools protocol, for measure-fps.mjs.
// No dependencies: Node's built-in fetch and WebSocket (D-033, D-040).
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The Chrome executable (CHROME_PATH overrides). */
export function findChrome() {
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
export function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32')
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

/** Waits until `url` answers 200. */
export async function waitFor(url, what) {
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

/**
 * A visible Chrome with a throwaway profile and anti-throttling flags. The camera is always
 * Chrome's fake device, allowed without a prompt (D-054); `clip` replaces its test pattern.
 */
export function launchChrome(port, clip) {
  return spawn(
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
      // Windows stops painting a window that another window fully covers, even with the flags
      // above (seen in T4: runs going silent while the editor was in front).
      '--disable-features=CalculateNativeWinOcclusion',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      ...(clip ? [`--use-file-for-fake-video-capture=${clip}`] : []),
      'about:blank',
    ],
    { stdio: 'ignore', detached: process.platform !== 'win32' },
  );
}

/** Text of one console argument (strings, numbers, and errors via their description). */
const argText = (a) => (a.value !== undefined ? String(a.value) : (a.description ?? a.type));

/**
 * A minimal DevTools protocol client for the first page: send() with a timeout, plus every
 * console line, uncaught exception and log entry (worker lines included) as text.
 */
export async function connect(port) {
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
  await send('Runtime.enable');
  await send('Log.enable');
  return { send, consoleLines, close: () => ws.close() };
}

/** Evaluates `expression` in the page and returns its value. */
export async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result?.value;
}
