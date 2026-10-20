import { describe, expect, it } from 'vitest';
import { createFakeClock } from '../core/clock';
import { createEventBus } from '../core/eventBus';
import type { EventMap } from '../core/events';
import { createMemoryStore, DEFAULT_SETTINGS, loadSettings } from './settings';
import {
  connectSettingsActions,
  createSettingsStore,
  settingsPatchForAction,
} from './settingsStore';

function setup() {
  const kv = createMemoryStore();
  const bus = createEventBus<EventMap>();
  const changes: EventMap['settings:changed'][] = [];
  bus.on('settings:changed', (e) => changes.push(e));
  const store = createSettingsStore(kv, bus, createFakeClock(5));
  return { kv, bus, store, changes };
}

describe('settingsStore', () => {
  it('saves a change and announces which fields changed', () => {
    const { kv, store, changes } = setup();
    store.update({ showPreview: false, previewFrame: 'portrait' });
    expect(loadSettings(kv).showPreview).toBe(false);
    expect(loadSettings(kv).previewFrame).toBe('portrait');
    expect(changes).toHaveLength(1);
    expect(changes[0]?.changed.sort()).toEqual(['previewFrame', 'showPreview']);
    expect(changes[0]?.t).toBe(5);
  });

  it('says nothing when a change changes nothing', () => {
    const { store, changes } = setup();
    store.update({ showPreview: true });
    expect(changes).toHaveLength(0);
  });

  it('refuses invalid values field by field', () => {
    const { store } = setup();
    store.update({ previewFrame: 'neon' as never, showPreview: false });
    expect(store.get().previewFrame).toBe(DEFAULT_SETTINGS.previewFrame);
    expect(store.get().showPreview).toBe(false);
  });
});

describe('settings actions', () => {
  it('preview.toggle flips showPreview; other actions change nothing', () => {
    expect(settingsPatchForAction('preview.toggle', DEFAULT_SETTINGS)).toEqual({
      showPreview: false,
    });
    expect(
      settingsPatchForAction('preview.toggle', { ...DEFAULT_SETTINGS, showPreview: false }),
    ).toEqual({ showPreview: true });
    expect(settingsPatchForAction('camera.retry', DEFAULT_SETTINGS)).toBeNull();
  });

  it('a toggle through the bus is saved, and survives a reload', () => {
    const { kv, bus, store } = setup();
    connectSettingsActions(bus, store);
    bus.emit('ui:action', { id: 'preview.toggle', t: 0 });
    expect(store.get().showPreview).toBe(false);
    const reloaded = createSettingsStore(kv, createEventBus<EventMap>(), createFakeClock());
    expect(reloaded.get().showPreview).toBe(false);
    bus.emit('ui:action', { id: 'preview.toggle', t: 1 });
    expect(store.get().showPreview).toBe(true);
  });
});
