// Which operating system the player is on, so a message can name the right settings page.

/** The platforms whose settings messages differ. */
export type Platform = 'mac' | 'windows' | 'other';

/** Reads a platform name such as "macOS", "MacIntel", "Windows" or "Win32". Pure. */
export function parsePlatform(...names: (string | undefined)[]): Platform {
  for (const name of names) {
    if (!name) continue;
    if (/mac/i.test(name)) return 'mac';
    if (/win/i.test(name)) return 'windows';
  }
  return 'other';
}

/** Reads the `?platform=` dev override; null when absent or not a platform. */
export function parsePlatformOverride(value: string | null): Platform | null {
  return value === 'mac' || value === 'windows' || value === 'other' ? value : null;
}

/** The player's platform, from User-Agent Client Hints (Chrome) or `navigator.platform`. */
export function detectPlatform(): Platform {
  const hints = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  // navigator.platform is deprecated but is still the fallback where hints are missing.
  return parsePlatform(hints?.platform, navigator.platform);
}
