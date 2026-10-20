// Persisted user settings (FR-22). Stored as JSON under a versioned key.
// Every field is validated on its own: a bad value falls back to that field's default,
// so one corrupt field never resets the rest, and fields added later are filled in
// from the defaults without wiping what the player already saved (D-026).
// A breaking change to the format gets a new key (wg.settings.v2) plus a migration from v1.

/** Speech recognition languages offered in settings. */
export type VoiceLang = 'en-US' | 'en-IN';

/** Everything the settings panel controls. */
export interface Settings {
  voiceLang: VoiceLang;
  /** Off = gesture-only mode. */
  voiceRequired: boolean;
  inputMode: 'hand' | 'mouse';
  wandHand: 'any' | 'left' | 'right';
  /** Faint guide shape on the stage while tracing. */
  guideShapes: boolean;
  /** 0 (silent) to 1. */
  masterVolume: number;
  /** Dev: active gesture recognizer. */
  recognizer: 'protractor' | 'dollarOne';
  /** Dev: default + personal templates, or personal only. */
  templateMode: 'all' | 'mineOnly';
}

/** The localStorage key. The version is part of the key. */
export const SETTINGS_KEY = 'wg.settings.v1';

/** Settings for a first run, and the fallback for any bad field. */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  voiceLang: 'en-US',
  voiceRequired: true,
  inputMode: 'hand',
  wandHand: 'any',
  guideShapes: true,
  masterVolume: 0.8,
  recognizer: 'protractor',
  templateMode: 'all',
};

/** The subset of the Web Storage API settings need; injected so tests need no browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Validator<T> = (value: unknown) => value is T;

const oneOf =
  <T extends string>(...options: readonly T[]): Validator<T> =>
  (value): value is T =>
    typeof value === 'string' && (options as readonly string[]).includes(value);

const isBoolean: Validator<boolean> = (value): value is boolean => typeof value === 'boolean';

const isUnitNumber: Validator<number> = (value): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const VALIDATORS: { [K in keyof Settings]: Validator<Settings[K]> } = {
  voiceLang: oneOf('en-US', 'en-IN'),
  voiceRequired: isBoolean,
  inputMode: oneOf('hand', 'mouse'),
  wandHand: oneOf('any', 'left', 'right'),
  guideShapes: isBoolean,
  masterVolume: isUnitNumber,
  recognizer: oneOf('protractor', 'dollarOne'),
  templateMode: oneOf('all', 'mineOnly'),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function copyIfValid<K extends keyof Settings>(
  target: Settings,
  source: Record<string, unknown>,
  key: K,
): void {
  const candidate = source[key];
  if (VALIDATORS[key](candidate)) target[key] = candidate;
}

/** Turns any parsed value into valid settings, field by field. Never throws. */
export function sanitizeSettings(value: unknown): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return result;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    copyIfValid(result, value, key);
  }
  return result;
}

/** Loads settings from the store. Missing, corrupt or unreadable data gives defaults. */
export function loadSettings(store: KeyValueStore): Settings {
  let raw: string | null;
  try {
    raw = store.getItem(SETTINGS_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves settings. Returns false instead of throwing if storage is full or blocked. */
export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** A store that lives only in memory. The fallback when localStorage is unavailable. */
export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** Returns localStorage if it works, otherwise an in-memory store (e.g. storage blocked). */
export function browserStore(): KeyValueStore {
  try {
    const storage = globalThis.localStorage;
    const probe = '__wg_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStore();
  }
}
