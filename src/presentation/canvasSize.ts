import { RENDER } from '../config/tuning';

/** The pixel ratio to render at: the device's, but never above the cap (FR-17). */
export function effectiveDpr(deviceDpr: number, cap: number): number {
  const device = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  return Math.min(device, cap);
}

/** Canvas backing-store size in device pixels for a CSS size. Always at least 1×1. */
export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
  };
}

/**
 * Reads the `?dprCap=` measuring override from a URL query string.
 * Returns null when absent, not a number, or outside the allowed range.
 */
export function parseDprCapOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get('dprCap');
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (value < RENDER.dprCapOverrideMin || value > RENDER.dprCapOverrideMax) return null;
  return value;
}
