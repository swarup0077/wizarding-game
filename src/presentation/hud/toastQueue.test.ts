import { describe, expect, it } from 'vitest';
import { createToastQueue } from './toastQueue';

const make = () =>
  createToastQueue({ max: 2, lifetimeMs: { info: 1000, warn: 2000, error: 3000 } });

describe('toastQueue', () => {
  it('gives each toast the lifetime of its level', () => {
    const q = make();
    expect(q.push({ level: 'info', text: 'a' }).toast.lifetimeMs).toBe(1000);
    expect(q.push({ level: 'error', text: 'b' }).toast.lifetimeMs).toBe(3000);
  });

  it('never shows more than the cap, dropping the oldest', () => {
    const q = make();
    const a = q.push({ level: 'info', text: 'a' }).toast;
    q.push({ level: 'info', text: 'b' });
    const third = q.push({ level: 'warn', text: 'c' });
    expect(third.evicted?.id).toBe(a.id);
    expect(q.visible().map((t) => t.text)).toEqual(['b', 'c']);
  });

  it('refreshes an identical toast instead of stacking it', () => {
    const q = make();
    const first = q.push({ level: 'info', text: 'same' });
    const again = q.push({ level: 'info', text: 'same' });
    expect(again.refreshed).toBe(true);
    expect(again.toast.id).toBe(first.toast.id);
    expect(q.visible()).toHaveLength(1);
  });

  it('removes a toast once, and keeps its action', () => {
    const q = make();
    const { toast } = q.push({
      level: 'error',
      text: 'x',
      action: { id: 'camera.retry', label: 'Retry' },
    });
    expect(q.visible()[0]?.action?.id).toBe('camera.retry');
    expect(q.remove(toast.id)).toBe(true);
    expect(q.remove(toast.id)).toBe(false);
    expect(q.visible()).toHaveLength(0);
  });
});
