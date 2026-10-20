import type { Clock } from '../core/clock';
import type { EventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import type { Settings } from '../core/settingsTypes';
import type { UiActionId } from '../core/types';
import { type KeyValueStore, loadSettings, sanitizeSettings, saveSettings } from './settings';

// The live settings: one copy for the session, saved on every change and announced on the
// bus as `settings:changed`, so any layer can follow a setting without reading storage.

/** The session's settings. */
export interface SettingsStore {
  get(): Readonly<Settings>;
  /** Applies a change (invalid values fall back per field), saves it and announces it. */
  update(patch: Partial<Settings>): Readonly<Settings>;
}

/** Loads settings from `kv` and creates the store. */
export function createSettingsStore(
  kv: KeyValueStore,
  bus: EventBus<EventMap>,
  clock: Clock,
): SettingsStore {
  let current = loadSettings(kv);

  return {
    get: () => current,
    update(patch) {
      const next = sanitizeSettings({ ...current, ...patch });
      const changed = (Object.keys(next) as (keyof Settings)[]).filter(
        (key) => next[key] !== current[key],
      );
      if (changed.length === 0) return current;
      current = next;
      saveSettings(kv, current);
      bus.emit('settings:changed', { settings: current, changed, t: clock.now() });
      return current;
    },
  };
}

/** The settings change a HUD action or shortcut asks for, if any. Pure. */
export function settingsPatchForAction(
  id: UiActionId,
  settings: Readonly<Settings>,
): Partial<Settings> | null {
  if (id === 'preview.toggle') return { showPreview: !settings.showPreview };
  return null;
}

/** Applies every settings-changing `ui:action` to the store. */
export function connectSettingsActions(bus: EventBus<EventMap>, store: SettingsStore): void {
  bus.on('ui:action', ({ id }) => {
    const patch = settingsPatchForAction(id, store.get());
    if (patch) store.update(patch);
  });
}
