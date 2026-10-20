import type { View } from './view';

/** Something drawn over the scene every frame: the trail, particles, the wand dot. */
export interface Layer {
  /** Advances by `dtMs`; `nowMs` is the frame's time on the shared clock. */
  update(dtMs: number, nowMs: number, view: View): void;
  /** Draws. `g` is already scaled so drawing is in CSS pixels. */
  render(g: CanvasRenderingContext2D, view: View): void;
}
