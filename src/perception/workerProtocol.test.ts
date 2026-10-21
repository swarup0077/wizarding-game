import { describe, expect, it } from 'vitest';
import { isFromWorker, isToWorker } from './workerProtocol';

describe('worker protocol', () => {
  it('accepts every well-formed worker message', () => {
    expect(
      isFromWorker({ type: 'ready', delegate: 'GPU', gpuError: null, loadMs: 900, warmupMs: 3100 }),
    ).toBe(true);
    expect(
      isFromWorker({
        type: 'ready',
        delegate: 'CPU',
        gpuError: 'no WebGL2',
        loadMs: 1,
        warmupMs: 1,
      }),
    ).toBe(true);
    expect(isFromWorker({ type: 'failed', detail: 'GPU: x; CPU: y' })).toBe(true);
    expect(
      isFromWorker({ type: 'result', frameId: 4, captureTime: 1234.5, hand: null, detectMs: 12 }),
    ).toBe(true);
    expect(isFromWorker({ type: 'error', frameId: 4, detail: 'lost context' })).toBe(true);
  });

  it('rejects malformed worker messages', () => {
    for (const bad of [
      null,
      'ready',
      { type: 'ready', delegate: 'TPU', gpuError: null, loadMs: 1, warmupMs: 1 },
      { type: 'ready', delegate: 'GPU', loadMs: 1, warmupMs: 1 },
      { type: 'result', frameId: '4', captureTime: 1, hand: null, detectMs: 1 },
      { type: 'result', frameId: 4, captureTime: 1, hand: 'hand', detectMs: 1 },
      { type: 'nope' },
    ])
      expect(isFromWorker(bad)).toBe(false);
  });

  it('accepts well-formed main-thread messages and rejects the rest', () => {
    expect(isToWorker({ type: 'init', assetBase: '/', delegates: ['GPU', 'CPU'] })).toBe(true);
    expect(isToWorker({ type: 'init', assetBase: '/', delegates: ['GPU', 'TPU'] })).toBe(false);
    expect(
      isToWorker({ type: 'frame', frame: {}, frameId: 1, timestamp: 100, captureTime: 99.5 }),
    ).toBe(true);
    expect(isToWorker({ type: 'frame', frameId: 1, timestamp: 100, captureTime: 99.5 })).toBe(
      false,
    );
    expect(isToWorker({ type: 'simulate', failure: 'hang', hangMs: 3000 })).toBe(true);
    expect(isToWorker({ type: 'simulate', failure: 'explode', hangMs: 0 })).toBe(false);
  });
});
