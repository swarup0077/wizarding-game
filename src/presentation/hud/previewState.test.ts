import { describe, expect, it } from 'vitest';
import { PREVIEW_COPY } from './cameraCopy';
import { type PreviewInputs, previewView } from './previewState';
import { TRACKING_COPY } from './trackingCopy';

const base: PreviewInputs = {
  cameraLive: true,
  showPreview: true,
  hand: 'unknown',
  tracker: 'ready',
};

describe('previewView', () => {
  it('shows the picture while the camera is live and the preview is on', () => {
    const view = previewView(base);
    expect(view.frameShown).toBe(true);
    expect(view.chipShown).toBe(false);
  });

  it('swaps the picture for the chip when the preview is hidden', () => {
    const view = previewView({ ...base, showPreview: false });
    expect(view.frameShown).toBe(false);
    expect(view.chipShown).toBe(true);
    expect(view.chipText).toBe(PREVIEW_COPY.chipCameraOn);
  });

  it('shows neither without a live camera (mouse mode, failures)', () => {
    for (const showPreview of [true, false]) {
      const view = previewView({ ...base, cameraLive: false, showPreview, hand: 'found' });
      expect(view.frameShown).toBe(false);
      expect(view.chipShown).toBe(false);
    }
  });

  it('reports the hand on the chip, in red ink when it is lost', () => {
    const seen = previewView({ ...base, showPreview: false, hand: 'found' });
    expect(seen.chipText).toBe(PREVIEW_COPY.chipHandSeen);
    expect(seen.chipTone).toBe('quiet');
    const lost = previewView({ ...base, showPreview: false, hand: 'lost' });
    expect(lost.chipText).toBe(PREVIEW_COPY.chipHandLost);
    expect(lost.chipTone).toBe('alert');
  });

  it('while the tracker readies, the chip says so, beside the picture or instead of it', () => {
    for (const showPreview of [true, false]) {
      const view = previewView({ ...base, showPreview, tracker: 'loading' });
      expect(view.chipShown).toBe(true);
      expect(view.chipText).toBe(TRACKING_COPY.readying);
      expect(view.chipTone).toBe('quiet');
      expect(view.frameShown).toBe(showPreview);
    }
  });

  it('once the tracker is ready or has failed, the readying line goes', () => {
    expect(previewView({ ...base, tracker: 'ready' }).chipShown).toBe(false);
    expect(previewView({ ...base, tracker: 'failed' }).chipShown).toBe(false);
  });

  it('draws the skeleton only over a visible picture with a ready tracker', () => {
    expect(previewView(base).skeletonShown).toBe(true);
    expect(previewView({ ...base, showPreview: false }).skeletonShown).toBe(false);
    expect(previewView({ ...base, cameraLive: false }).skeletonShown).toBe(false);
    expect(previewView({ ...base, tracker: 'loading' }).skeletonShown).toBe(false);
  });
});
