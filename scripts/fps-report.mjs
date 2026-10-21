// Turns the console lines a page logs with `?reportFps=1` into numbers and Markdown tables
// (used by measure-fps.mjs). Pure: lines in, summaries and table rows out.
//
//   [fps] 59.8 maxGapMs 17.2 workMs 1.4 wallGapMs 18.1 late 0 at 12345
//   [track] state ready delegate GPU fps 29.8 videoFps 30.0 detectMean 12.30 detectP95 15.10 firstMs 340 hand 1 at 12345

const STARTUP_SKIP_MS = 2000;
/** A gap longer than this belongs to the previous page being paused, not to this run. */
const PAUSE_GAP_MS = 5000;
const SLOW_FRAME_MS = 25;
/** Tracking runs are measured from this long after the tracker is ready (steady state). */
const TRACKING_SETTLE_MS = 1000;

// `wallGapMs` / `late` (T4) are optional, so older logs still parse.
const FPS_LINE =
  /\[fps\] ([\d.]+) maxGapMs ([\d.]+) workMs ([\d.]+)(?: wallGapMs ([\d.]+) late (\d+))? at (\d+)/;
const TRACK_LINE =
  /\[track\] state (\w+) delegate (\S+) fps ([\d.]+) videoFps ([\d.]+) detectMean ([\d.]+) detectP95 ([\d.]+) firstMs (\S+) hand (\d) at (\d+)/;

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

function parseFps(lines) {
  return lines
    .map((line) => line.match(FPS_LINE))
    .filter(Boolean)
    .map((m) => ({
      fps: +m[1],
      gap: +m[2],
      work: +m[3],
      wallGap: m[4] === undefined ? null : +m[4],
      late: m[5] === undefined ? null : +m[5],
      at: +m[6],
    }));
}

function parseTrack(lines) {
  return lines
    .map((line) => line.match(TRACK_LINE))
    .filter(Boolean)
    .map((m) => ({
      state: m[1],
      delegate: m[2],
      fps: +m[3],
      videoFps: +m[4],
      detectMean: +m[5],
      detectP95: +m[6],
      firstMs: m[7] === '-' ? null : +m[7],
      hand: m[8] === '1',
      at: +m[9],
    }));
}

function renderSummary(rows) {
  if (rows.length === 0) return null;
  return {
    seconds: rows.length,
    fpsMean: mean(rows.map((r) => r.fps)),
    fpsMin: Math.min(...rows.map((r) => r.fps)),
    maxGap: Math.max(...rows.map((r) => r.gap)),
    slowSeconds: rows.filter((r) => r.gap > SLOW_FRAME_MS).length,
    workMean: mean(rows.map((r) => r.work)),
    workMax: Math.max(...rows.map((r) => r.work)),
    wallGapMax: rows[0].wallGap === null ? null : Math.max(...rows.map((r) => r.wallGap)),
    latePerSecond: rows[0].late === null ? null : mean(rows.map((r) => r.late)),
  };
}

/** Render numbers after startup (every run). */
export function summarizeRender(lines) {
  return renderSummary(
    parseFps(lines).filter((r) => r.at >= STARTUP_SKIP_MS && r.gap < PAUSE_GAP_MS),
  );
}

/**
 * Tracking runs: tracking numbers and render numbers over the steady state (from 1 s after
 * the tracker is ready), plus when it became ready and the longest frame gap before that
 * (page load, wasm and model start-up together).
 */
export function summarizeTracking(lines) {
  const track = parseTrack(lines);
  const ready = track.find((r) => r.state === 'ready' && r.fps > 0);
  const failed = track.find((r) => r.state === 'failed');
  if (!ready) return { readyAt: null, failed: Boolean(failed) };
  const from = ready.at + TRACKING_SETTLE_MS;
  const steady = track.filter((r) => r.at >= from && r.state === 'ready');
  const fpsRows = parseFps(lines).filter((r) => r.gap < PAUSE_GAP_MS);
  const before = fpsRows.filter((r) => r.at < from);
  if (steady.length === 0) return { readyAt: ready.at, failed: false };
  return {
    readyAt: ready.at,
    failed: false,
    startupMaxGap: before.length ? Math.max(...before.map((r) => r.gap)) : null,
    delegate: steady.at(-1).delegate,
    fpsMean: mean(steady.map((r) => r.fps)),
    fpsMin: Math.min(...steady.map((r) => r.fps)),
    videoFps: mean(steady.map((r) => r.videoFps)),
    // Each line's mean and p95 cover the last ~4 s; report the mean of means and the
    // worst p95 seen, so a bad stretch isn't averaged away.
    detectMean: mean(steady.map((r) => r.detectMean)),
    detectP95: Math.max(...steady.map((r) => r.detectP95)),
    firstMs: steady.at(-1).firstMs,
    handShare: steady.filter((r) => r.hand).length / steady.length,
    render: renderSummary(fpsRows.filter((r) => r.at >= from)),
  };
}

const f = (n, digits = 1) => (n === null || n === undefined ? '–' : n.toFixed(digits));

/** The render table (every run). */
export function renderTable(results) {
  const out = [
    '| Run | Canvas (device px) | fps mean / min | Longest frame gap | Seconds with a gap > 25 ms | Longest real gap | Late frames per s | Our work per frame (mean / max) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const { run, canvas, render: s } of results) {
    if (!s) out.push(`| ${run.name} | ${canvas} | no data | | | | | |`);
    else
      out.push(
        `| ${run.name} | ${canvas} | ${f(s.fpsMean)} / ${f(s.fpsMin, 0)} | ${f(s.maxGap)} ms | ${s.slowSeconds} of ${s.seconds} | ${f(s.wallGapMax)} ms | ${f(s.latePerSecond)} | ${f(s.workMean, 2)} / ${f(s.workMax, 2)} ms |`,
      );
  }
  return out.join('\n');
}

/** The tracking table (tracking runs only). */
export function trackingTable(results) {
  const out = [
    '| Run | Delegate | Tracking fps mean / min | Video fps | Detection mean / p95 | First detection | Hand seen | Render fps mean / min | Longest real gap | Late frames per s | Ready at / longest gap before |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const { run, tracking: t } of results) {
    if (!t) continue;
    if (t.readyAt === null) {
      out.push(`| ${run.name} | ${t.failed ? 'failed' : 'never ready'} | | | | | | | | | |`);
      continue;
    }
    if (t.fpsMean === undefined) {
      out.push(
        `| ${run.name} | ready at ${t.readyAt} ms, no steady data (run longer) | | | | | | | | |`,
      );
      continue;
    }
    const r = t.render;
    out.push(
      `| ${run.name} | ${t.delegate} | ${f(t.fpsMean)} / ${f(t.fpsMin, 0)} | ${f(t.videoFps)} | ${f(t.detectMean)} / ${f(t.detectP95)} ms | ${f(t.firstMs, 0)} ms | ${Math.round(t.handShare * 100)}% | ${r ? `${f(r.fpsMean)} / ${f(r.fpsMin, 0)}` : '–'} | ${r ? `${f(r.wallGapMax)} ms` : '–'} | ${r ? f(r.latePerSecond) : '–'} | ${(t.readyAt / 1000).toFixed(1)} s / ${f(t.startupMaxGap)} ms |`,
    );
  }
  return out.join('\n');
}

/** Console lines that aren't our measurement lines (MediaPipe's start-up output, errors). */
export function otherLines(lines) {
  return [...new Set(lines.filter((l) => !FPS_LINE.test(l) && !TRACK_LINE.test(l)))];
}
