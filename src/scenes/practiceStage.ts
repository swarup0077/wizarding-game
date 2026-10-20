import { RENDER } from '../config/tuning';
import type { View } from '../presentation/view';
import { renderPracticeBackground } from './practiceBackground';
import type { Scene } from './scene';

/** The Phase 0 practice stage. T1: the background only; props arrive in T11. */
export function createPracticeStage(): Scene {
  let background: HTMLCanvasElement | null = null;
  let cachedKey = '';
  let pendingKey = '';
  let msSinceSizeChange = 0;

  const keyFor = (view: View): string => `${view.width}x${view.height}@${view.pixelRatio}`;

  return {
    load: () => Promise.resolve(),

    update(dtMs) {
      msSinceSizeChange += dtMs;
    },

    render(g, view) {
      const key = keyFor(view);
      if (key !== pendingKey) {
        pendingKey = key;
        msSinceSizeChange = 0;
      }
      // Redraw the cached background on the first frame, then only once resizing settles.
      // Until then the old image is stretched, which is invisible during a drag.
      const settled = msSinceSizeChange >= RENDER.resizeSettleMs;
      if (!background || (key !== cachedKey && settled)) {
        background = renderPracticeBackground(view);
        cachedKey = key;
      }
      g.drawImage(background, 0, 0, view.width, view.height);
    },

    unload() {
      background = null;
    },
  };
}
