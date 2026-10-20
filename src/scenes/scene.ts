import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { View } from '../presentation/view';

/** What a scene receives when it loads. Grows as later tasks add services. */
export interface SceneContext {
  bus: EventBus<EventMap>;
}

/** A place the player can be: the practice stage now, rooms and classes later. */
export interface Scene {
  /** Prepares the scene. Resolves when it is ready to render. */
  load(ctx: SceneContext): Promise<void>;
  /** Advances the scene by `dtMs` milliseconds. */
  update(dtMs: number): void;
  /** Draws the scene. `g` is already scaled so drawing is in CSS pixels. */
  render(g: CanvasRenderingContext2D, view: View): void;
  /** Releases everything the scene holds. */
  unload(): void;
}
