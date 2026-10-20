import { createEventBus, type EventBus } from './core/eventBus';
import type { EventMap } from './core/events';
import { browserStore, loadSettings, type Settings } from './settings/settings';

/** What the running game is built from. Later tasks add sources, the scene and the loop. */
export interface App {
  bus: EventBus<EventMap>;
  settings: Settings;
}

/** Creates the event bus and loads settings. Nothing is visible yet (T0). */
export function bootstrap(): App {
  const bus = createEventBus<EventMap>();
  const settings = loadSettings(browserStore());
  return { bus, settings };
}

bootstrap();
