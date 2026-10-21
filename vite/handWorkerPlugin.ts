import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build, type InlineConfig, type Plugin, type ResolvedConfig } from 'vite';

// Builds the hand worker (src/perception/worker/handWorker.ts) as one classic script and
// tells the app where it is (T4, D-066). MediaPipe loads its wasm glue with importScripts,
// which exists only in classic workers, and Vite's own worker support serves workers as ES
// modules in dev; so the worker is a separate Vite build (IIFE, no code splitting).
//
// - `npm run dev`: built in watch mode into Vite's cache, served at <base>workers/hand-worker.js.
// - `npm run build`: emitted as <base>workers/hand-worker.<content hash>.js. The main bundle
//   gets that exact name, so a cached old worker can never pair with a newer main bundle.
//
// The app imports the URL from `virtual:hand-worker` (`HAND_WORKER_URL`).

const ENTRY = 'src/perception/worker/handWorker.ts';
const VIRTUAL_ID = 'virtual:hand-worker';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const DEV_FILE = 'hand-worker.js';

function workerBuild(root: string, extra: NonNullable<InlineConfig['build']>): InlineConfig {
  return {
    configFile: false,
    root,
    logLevel: 'warn',
    publicDir: false,
    build: {
      lib: {
        entry: resolve(root, ENTRY),
        formats: ['iife'],
        name: 'handWorker',
        fileName: () => DEV_FILE,
      },
      copyPublicDir: false,
      sourcemap: false,
      // A classic script is one file: MediaPipe's dynamic import is inlined.
      rolldownOptions: { output: { codeSplitting: false } },
      ...extra,
    },
  };
}

/** The Vite plugin that builds the hand worker and provides `virtual:hand-worker`. */
export function handWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  let url = '';

  return {
    name: 'wg-hand-worker',

    configResolved(resolved) {
      config = resolved;
      url = `${config.base}workers/${DEV_FILE}`;
    },

    async buildStart() {
      if (config.command !== 'build') return;
      const output = await build(workerBuild(config.root, { write: false, emptyOutDir: false }));
      const outputs = Array.isArray(output) ? output : [output];
      const chunk = outputs
        .flatMap((o) => ('output' in o ? o.output : []))
        .find((file) => file.type === 'chunk');
      if (!chunk || chunk.type !== 'chunk')
        throw new Error('The hand worker build produced no script.');
      const hash = createHash('sha256').update(chunk.code).digest('hex').slice(0, 10);
      const fileName = `workers/hand-worker.${hash}.js`;
      this.emitFile({ type: 'asset', fileName, source: chunk.code });
      url = `${config.base}${fileName}`;
    },

    async configureServer(server) {
      const outDir = join(config.cacheDir, 'hand-worker');
      let firstBuild!: Promise<void>;
      const watcher = await new Promise<Awaited<ReturnType<typeof build>>>((done) => {
        firstBuild = new Promise((built) => {
          void build(workerBuild(config.root, { outDir, emptyOutDir: true, watch: {} })).then(
            (w) => {
              done(w);
              if ('on' in w)
                w.on('event', (event) => {
                  if (event.code === 'BUNDLE_END') void event.result.close();
                  if (event.code === 'ERROR') {
                    void event.result.close();
                    config.logger.error(`[hand worker] ${event.error.message}`);
                  }
                  if (event.code === 'END' || event.code === 'ERROR') built();
                });
            },
          );
        });
      });
      server.httpServer?.on('close', () => {
        if ('close' in watcher) void watcher.close();
      });
      server.middlewares.use(url, (_req, res) => {
        void firstBuild
          .then(() => readFile(join(outDir, DEV_FILE)))
          .then(
            (code) => {
              res.setHeader('Content-Type', 'text/javascript');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(code);
            },
            () => {
              res.statusCode = 500;
              res.end('The hand worker failed to build; see the dev server log.');
            },
          );
      });
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    load(id) {
      return id === RESOLVED_ID ? `export const HAND_WORKER_URL = ${JSON.stringify(url)};\n` : null;
    },
  };
}
