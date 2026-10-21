import { describe, expect, it } from 'vitest';
import { slowTrackingTip, TRACKING_COPY, trackerNotice } from './trackingCopy';

describe('trackingCopy', () => {
  it('the readying line is short enough for the status chip', () => {
    expect(TRACKING_COPY.readying.length).toBeLessThanOrEqual(24);
  });

  it('the slow tip gives the lighting and the distance advice', () => {
    const tip = slowTrackingTip(40, 80);
    expect(tip).toMatch(/light/i);
    expect(tip).toContain('40–80 cm');
  });

  it('only a failure becomes a toast, and it offers the mouse', () => {
    expect(trackerNotice({ state: 'loading', t: 0 })).toBeNull();
    expect(trackerNotice({ state: 'ready', delegate: 'GPU', t: 0 })).toBeNull();
    for (const failure of ['unsupported', 'load-failed'] as const) {
      const notice = trackerNotice({ state: 'failed', failure, detail: 'x', t: 0 });
      expect(notice?.level).toBe('error');
      expect(notice?.text).toMatch(/mouse/);
      expect(notice?.action?.id).toBe('camera.useMouse');
    }
  });

  it('a failure without a kind still gets plain words', () => {
    expect(trackerNotice({ state: 'failed', t: 0 })?.text).toMatch(/couldn't start/);
  });
});
