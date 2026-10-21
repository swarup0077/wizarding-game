// Turns the console lines a page logs with `?reportFps=1` into numbers and Markdown tables
// (used by measure-fps.mjs). Pure: lines in, summaries and table rows out.
//
//   [fps] 59.8 maxGapMs 17.2 workMs 1.4 wallGapMs 18.1 late 0 at 12345
//   [track] state ready thread worker delegate GPU fps 29.8 videoFps 30.0 detectMean 12.30 detectP95 15.10 firstMs 34 warmMs 3100 latency 48.0 skew 33.0 hand 1 since 2500 ready 6100 at 12345

const STARTUP_SKIP_MS = 2000;
/** A gap longer than this belongs to the previous page being paused, not to this run. */
const PAUSE_GAP_MS = 5000;
const SLOW_FRAME_MS = 25;
/** Tracking runs are measured from this long after the tracker is ready (steady state). */
const TRACKING_SETTLE_MS = 1000;

/** A steady second whose camera rate falls below this share of the run's median means the fake camera stalled. */
const CAMERA_STALL_SHARE = 0.5;

/** The NFR-1 / AC-2 bar (D-065): render fps, late frames per second, longest real gap. */
export const QUALITY_BAR = { minFps: 55, maxLatePerSecond: 1, maxGapMs: 50 };

// `wallGapMs` / `late` (T4) are optional, so older logs still parse.
const FPS_LINE =
  /\[fps\] ([\d.]+) maxGapMs ([\d.]+) workMs ([\d.]+)(?: wallGapMs ([\d.]+) late (\d+))? at (\d+)/;
const TRACK_LINE =
  /\[track\] state (\w+) thread (\S+) delegate (\S+) fps ([\d.]+) videoFps ([\d.]+) detectMean ([\d.]+) detectP95 ([\d.]+) firstMs (\S+) warmMs (\S+) latency ([\d.]+) skew ([\d.]+) hand (\d) since (\S+) ready (\S+) at (\d+)/;

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

const num = (text) => (text === '-' ? null : +text);

function parseTrack(lines) {
  return lines
    .map((line) => line.match(TRACK_LINE))
    .filter(Boolean)
    .map((m) => ({
      state: m[1],
      thread: m[2],
      delegate: m[3],
      fps: +m[4],
      videoFps: +m[5],
      detectMean: +m[6],
      detectP95: +m[7],
      firstMs: num(m[8]),
      warmMs: num(m[9]),
      latency: +m[10],
      skew: +m[11],
      hand: m[12] === '1',
      loadingAt: num(m[13]),
      readyAt: num(m[14]),
      at: +m[15],
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
    lateWorstSecond: rows[0].late === null ? null : Math.max(...rows.map((r) => r.late)),
  };
}

/** Whether a steady-state render summary meets the bar, with the reasons when not. */
export function meetsBar(render, startupGap) {
  if (!render) return { pass: false, misses: ['no data'] };
  const misses = [];
  if (render.fpsMean < QUALITY_BAR.minFps) misses.push(`fps ${render.fpsMean.toFixed(1)}`);
  if (render.latePerSecond > QUALITY_BAR.maxLatePerSecond)
    misses.push(`late ${render.latePerSecond.toFixed(1)}/s`);
  if (render.wallGapMax > QUALITY_BAR.maxGapMs)
    misses.push(`gap ${render.wallGapMax.toFixed(0)} ms`);
  if (startupGap !== null && startupGap > QUALITY_BAR.maxGapMs)
    misses.push(`start gap ${startupGap.toFixed(0)} ms`);
  return { pass: misses.length === 0, misses };
}

/** Render numbers after startup (every run). */
export function summarizeRender(lines) {
  return renderSummary(
    parseFps(lines).filter((r) => r.at >= STARTUP_SKIP_MS && r.gap < PAUSE_GAP_MS),
  );
}

/**
 * Tracking runs. Steady state: tracking and render numbers from 1 s after the tracker is
 * ready. Start-up: the longest real frame gap in the seconds from the moment the tracker
 * began loading to 1 s after it was ready (the first-load freeze, if it reaches the screen).
 * Each [fps] line covers the second before it. Start the camera a few seconds after page
 * load (`&enable=2500`) so page load isn't counted.
 */
export function summarizeTracking(lines) {
  const track = parseTrack(lines);
  const ready = track.find((r) => r.state === 'ready' && r.fps > 0);
  const loadingAt = ready?.loadingAt ?? null;
  const readyAt = ready?.readyAt ?? null;
  const failed = track.find((r) => r.state === 'failed');
  // No ready line with frames: the tracker failed, or the camera never delivered (a stall).
  if (!ready) return { readyAt: null, failed: Boolean(failed), stalled: !failed };
  const from = (readyAt ?? ready.at) + TRACKING_SETTLE_MS;
  const steady = track.filter((r) => r.at >= from && r.state === 'ready');
  const fpsRows = parseFps(lines).filter((r) => r.gap < PAUSE_GAP_MS);
  // A line at `at` covers (at − 1000, at]: the window starts with the line after loadingAt.
  const startRows = fpsRows.filter((r) => r.at > (loadingAt ?? 0) && r.at - 1000 < from);
  const startupGap =
    startRows.length && startRows[0].wallGap !== null
      ? Math.max(...startRows.map((r) => r.wallGap))
      : null;
  if (steady.length === 0) return { readyAt: ready.at, failed: false };
  const last = steady.at(-1);
  const videoRates = steady.map((r) => r.videoFps).sort((a, b) => a - b);
  const medianVideo = videoRates[Math.floor(videoRates.length / 2)];
  // The run's last second is cut by the next navigation, so it doesn't count.
  const stalled = steady.slice(0, -1).some((r) => r.videoFps < CAMERA_STALL_SHARE * medianVideo);
  const render = renderSummary(fpsRows.filter((r) => r.at >= from));
  return {
    readyAt: readyAt ?? ready.at,
    loadingAt,
    failed: false,
    stalled,
    startupGap,
    thread: last.thread,
    delegate: last.delegate,
    fpsMean: mean(steady.map((r) => r.fps)),
    fpsMin: Math.min(...steady.map((r) => r.fps)),
    videoFps: mean(steady.map((r) => r.videoFps)),
    // Each line's mean and p95 cover the last ~4 s; report the mean of means and the
    // worst p95 seen, so a bad stretch isn't averaged away.
    detectMean: mean(steady.map((r) => r.detectMean)),
    detectP95: Math.max(...steady.map((r) => r.detectP95)),
    firstMs: last.firstMs,
    warmMs: last.warmMs,
    latency: mean(steady.map((r) => r.latency)),
    skew: mean(steady.map((r) => r.skew)),
    handShare: steady.filter((r) => r.hand).length / steady.length,
    render,
    bar: meetsBar(render, startupGap),
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
    '| Run | Runs on | Tracking fps (video) | Detection mean / p95 | Start: load → ready / warm-up / first detection | Capture → result | Skeleton skew | Hand seen | Render fps | Late frames per s (worst s) | Longest real gap | Start-up longest gap | Bar |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const empty = ' |'.repeat(11);
  for (const { run, tracking: t } of results) {
    if (!t) continue;
    if (t.readyAt === null) {
      const why = t.failed ? 'failed' : 'never ready: CAMERA STALLED? rerun';
      out.push(`| ${run.name} | ${why} |${empty}`);
      continue;
    }
    if (t.fpsMean === undefined) {
      out.push(`| ${run.name} | ready at ${t.readyAt} ms, no steady data |${empty}`);
      continue;
    }
    const r = t.render;
    const verdict = t.bar.pass ? 'PASS' : `FAIL (${t.bar.misses.join(', ')})`;
    const bar = t.stalled ? `INVALID: CAMERA STALLED, rerun (${verdict})` : verdict;
    out.push(
      `| ${run.name} | ${t.thread} · ${t.delegate} | ${f(t.fpsMean)} (${f(t.videoFps, 0)}) | ${f(t.detectMean)} / ${f(t.detectP95)} ms | ${t.loadingAt === null ? '–' : f(t.readyAt - t.loadingAt, 0)} / ${f(t.warmMs, 0)} / ${f(t.firstMs, 0)} ms | ${f(t.latency, 0)} ms | ${f(t.skew, 0)} ms | ${Math.round(t.handShare * 100)}% | ${r ? `${f(r.fpsMean)} / ${f(r.fpsMin, 0)}` : '–'} | ${r ? `${f(r.latePerSecond)} (${f(r.lateWorstSecond, 0)})` : '–'} | ${r ? `${f(r.wallGapMax)} ms` : '–'} | ${f(t.startupGap)} ms | ${bar} |`,
    );
  }
  return out.join('\n');
}

/** Console lines that aren't our measurement lines (MediaPipe's start-up output, errors). */
export function otherLines(lines) {
  return [...new Set(lines.filter((l) => !FPS_LINE.test(l) && !TRACK_LINE.test(l)))];
}
