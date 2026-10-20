import { describe, expect, it } from 'vitest';
import { PREVIEW_COPY } from './cameraCopy';
import { previewView } from './previewState';

describe('previewView', () => {
  it('shows the picture while the camera is live and the preview is on', () => {
    const view = previewView({ cameraLive: true, showPreview: true, hand: 'unknown' });
    expect(view.frameShown).toBe(true);
    expect(view.chipShown).toBe(false);
  });

  it('swaps the picture for the chip when the preview is hidden', () => {
    const view = previewView({ cameraLive: true, showPreview: false, hand: 'unknown' });
    expect(view.frameShown).toBe(false);
    expect(view.chipShown).toBe(true);
    expect(view.chipText).toBe(PREVIEW_COPY.chipCameraOn);
  });

  it('shows neither without a live camera (mouse mode, failures)', () => {
    for (const showPreview of [true, false]) {
      const view = previewView({ cameraLive: false, showPreview, hand: 'found' });
      expect(view.frameShown).toBe(false);
      expect(view.chipShown).toBe(false);
    }
  });

  it('reports the hand on the chip, in red ink when it is lost', () => {
    const seen = previewView({ cameraLive: true, showPreview: false, hand: 'found' });
    expect(seen.chipText).toBe(PREVIEW_COPY.chipHandSeen);
    expect(seen.chipTone).toBe('quiet');
    const lost = previewView({ cameraLive: true, showPreview: false, hand: 'lost' });
    expect(lost.chipText).toBe(PREVIEW_COPY.chipHandLost);
    expect(lost.chipTone).toBe('alert');
  });
});
