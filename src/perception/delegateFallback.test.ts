import { describe, expect, it } from 'vitest';
import type { TrackerDelegate } from '../core/types';
import {
  createWithFallback,
  DELEGATE_ORDER,
  DelegatesFailedError,
  delegateOrdersFromQuery,
  errorText,
  nextDelegate,
} from './delegateFallback';

describe('createWithFallback', () => {
  it('uses the GPU when it works, without trying the CPU', async () => {
    const tried: TrackerDelegate[] = [];
    const choice = await createWithFallback(DELEGATE_ORDER, (d) => {
      tried.push(d);
      return Promise.resolve(`landmarker on ${d}`);
    });
    expect(choice).toEqual({ value: 'landmarker on GPU', delegate: 'GPU', failed: [] });
    expect(tried).toEqual(['GPU']);
  });

  it('falls back to the CPU and records why the GPU failed', async () => {
    const choice = await createWithFallback(DELEGATE_ORDER, (d) =>
      d === 'GPU' ? Promise.reject(new Error('WebGL2 unavailable')) : Promise.resolve('cpu'),
    );
    expect(choice.delegate).toBe('CPU');
    expect(choice.value).toBe('cpu');
    expect(choice.failed).toEqual([{ delegate: 'GPU', error: 'WebGL2 unavailable' }]);
  });

  it('throws with every reason when no delegate works', async () => {
    const attempt = createWithFallback(DELEGATE_ORDER, (d) =>
      Promise.reject(new Error(`${d} broke`)),
    );
    await expect(attempt).rejects.toBeInstanceOf(DelegatesFailedError);
    await expect(attempt).rejects.toMatchObject({
      attempts: [
        { delegate: 'GPU', error: 'GPU broke' },
        { delegate: 'CPU', error: 'CPU broke' },
      ],
    });
  });

  it('a forced order (?delegate=cpu) tries only the CPU', async () => {
    const tried: TrackerDelegate[] = [];
    await createWithFallback(['CPU'], (d) => {
      tried.push(d);
      return Promise.resolve(d);
    });
    expect(tried).toEqual(['CPU']);
  });
});

describe('nextDelegate', () => {
  it('gives the CPU after the GPU, and nothing after the CPU', () => {
    expect(nextDelegate(DELEGATE_ORDER, 'GPU')).toBe('CPU');
    expect(nextDelegate(DELEGATE_ORDER, 'CPU')).toBeNull();
    expect(nextDelegate(['CPU'], 'GPU')).toBeNull();
  });
});

describe('delegateOrdersFromQuery', () => {
  it('the worker tries the CPU first; the main thread the GPU first (D-068)', () => {
    expect(delegateOrdersFromQuery('')).toEqual({ worker: ['CPU', 'GPU'], main: ['GPU', 'CPU'] });
    expect(delegateOrdersFromQuery('?delegate=tpu')).toEqual({
      worker: ['CPU', 'GPU'],
      main: ['GPU', 'CPU'],
    });
  });

  it('?delegate= forces one delegate on both threads', () => {
    expect(delegateOrdersFromQuery('?delegate=cpu')).toEqual({ worker: ['CPU'], main: ['CPU'] });
    expect(delegateOrdersFromQuery('?dprCap=2&delegate=GPU')).toEqual({
      worker: ['GPU'],
      main: ['GPU'],
    });
  });
});

describe('errorText', () => {
  it('reads errors, strings and anything else', () => {
    expect(errorText(new TypeError('bad'))).toBe('bad');
    expect(errorText(new Error(''))).toBe('Error');
    expect(errorText('plain')).toBe('plain');
    expect(errorText(42)).toBe('Unknown error');
  });
});
