import { describe, expect, it } from 'vitest';
import { PREVIEW_FRAMES } from '../core/settingsTypes';
import {
  browserStore,
  createMemoryStore,
  DEFAULT_SETTINGS,
  type KeyValueStore,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  type Settings,
  SETTINGS_KEY,
} from './settings';

const storeWith = (raw: string): KeyValueStore => {
  const store = createMemoryStore();
  store.setItem(SETTINGS_KEY, raw);
  return store;
};

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('settings', () => {
  it('gives defaults on a first run', () => {
    expect(loadSettings(createMemoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through save and load', () => {
    const store = createMemoryStore();
    const custom: Settings = {
      voiceLang: 'en-IN',
      voiceRequired: false,
      inputMode: 'mouse',
      wandHand: 'left',
      guideShapes: false,
      masterVolume: 0.25,
      recognizer: 'dollarOne',
      templateMode: 'mineOnly',
      previewFrame: 'portrait',
      showPreview: false,
    };

    expect(saveSettings(store, custom)).toBe(true);
    expect(loadSettings(store)).toEqual(custom);
  });

  it('gives defaults for corrupt JSON', () => {
    expect(loadSettings(storeWith('{"voiceLang": "en-IN"'))).toEqual(DEFAULT_SETTINGS);
  });

  it.each(['null', '42', '"text"', '[1, 2]'])('gives defaults when the JSON is %s', (raw) => {
    expect(loadSettings(storeWith(raw))).toEqual(DEFAULT_SETTINGS);
  });

  it('resets only the fields that are invalid', () => {
    const raw = JSON.stringify({
      voiceLang: 'fr-FR',
      voiceRequired: 'yes',
      masterVolume: 1.5,
      wandHand: 'right',
      inputMode: 'mouse',
    });

    const loaded = loadSettings(storeWith(raw));

    expect(loaded.voiceLang).toBe(DEFAULT_SETTINGS.voiceLang);
    expect(loaded.voiceRequired).toBe(DEFAULT_SETTINGS.voiceRequired);
    expect(loaded.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
    expect(loaded.wandHand).toBe('right');
    expect(loaded.inputMode).toBe('mouse');
  });

  it('rejects a volume that is not a finite number', () => {
    expect(sanitizeSettings({ masterVolume: Number.NaN }).masterVolume).toBe(0.8);
    expect(sanitizeSettings({ masterVolume: -0.1 }).masterVolume).toBe(0.8);
    expect(sanitizeSettings({ masterVolume: 0 }).masterVolume).toBe(0);
  });

  it('fills in fields missing from older saved data (migration within v1)', () => {
    const olderSave = JSON.stringify({ voiceLang: 'en-IN', masterVolume: 0.5 });

    expect(loadSettings(storeWith(olderSave))).toEqual({
      ...DEFAULT_SETTINGS,
      voiceLang: 'en-IN',
      masterVolume: 0.5,
    });
  });

  describe('webcam preview fields', () => {
    it('default to the minimal frame, with the preview shown', () => {
      expect(DEFAULT_SETTINGS.previewFrame).toBe('minimal');
      expect(DEFAULT_SETTINGS.previewFrame).toBe(PREVIEW_FRAMES[0]);
      expect(DEFAULT_SETTINGS.showPreview).toBe(true);
    });

    it('accept every frame style in PREVIEW_FRAMES', () => {
      for (const style of PREVIEW_FRAMES)
        expect(sanitizeSettings({ previewFrame: style }).previewFrame).toBe(style);
    });

    it('reset an unknown frame style or a non-boolean showPreview on their own', () => {
      const loaded = sanitizeSettings({
        previewFrame: 'neon',
        showPreview: 'no',
        wandHand: 'left',
      });
      expect(loaded.previewFrame).toBe('minimal');
      expect(loaded.showPreview).toBe(true);
      expect(loaded.wandHand).toBe('left');
    });

    it('keep a hidden preview across a reload', () => {
      const store = createMemoryStore();
      saveSettings(store, { ...DEFAULT_SETTINGS, showPreview: false });
      expect(loadSettings(store).showPreview).toBe(false);
    });

    it('are filled in for saves from before they existed', () => {
      const t3Save = JSON.stringify({
        ...DEFAULT_SETTINGS,
        previewFrame: undefined,
        showPreview: undefined,
        wandHand: 'right',
      });
      const loaded = loadSettings(storeWith(t3Save));
      expect(loaded.previewFrame).toBe('minimal');
      expect(loaded.showPreview).toBe(true);
      expect(loaded.wandHand).toBe('right');
    });
  });

  it('drops unknown fields', () => {
    const loaded = loadSettings(storeWith(JSON.stringify({ wandHand: 'left', oldThing: 1 })));
    expect(loaded).not.toHaveProperty('oldThing');
    expect(loaded.wandHand).toBe('left');
  });

  it('gives defaults when storage cannot be read', () => {
    expect(loadSettings(throwingStore)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns false instead of throwing when storage cannot be written', () => {
    expect(saveSettings(throwingStore, { ...DEFAULT_SETTINGS })).toBe(false);
  });

  it('never hands out the shared defaults object', () => {
    const loaded = loadSettings(createMemoryStore());
    loaded.masterVolume = 0.1;
    expect(DEFAULT_SETTINGS.masterVolume).toBe(0.8);
  });

  it('browserStore always returns a working store', () => {
    const store = browserStore();
    store.setItem('wg.test', 'ok');
    expect(store.getItem('wg.test')).toBe('ok');
    store.removeItem('wg.test');
  });
});
