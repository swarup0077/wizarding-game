import { describe, expect, it } from 'vitest';
import { parsePlatform, parsePlatformOverride } from './platform';

describe('platform', () => {
  it('reads Client Hints and navigator.platform names', () => {
    expect(parsePlatform('macOS')).toBe('mac');
    expect(parsePlatform(undefined, 'MacIntel')).toBe('mac');
    expect(parsePlatform('Windows')).toBe('windows');
    expect(parsePlatform('', 'Win32')).toBe('windows');
    expect(parsePlatform('Linux', 'Linux x86_64')).toBe('other');
    expect(parsePlatform()).toBe('other');
  });

  it('prefers the first name that says something', () => {
    expect(parsePlatform('macOS', 'Win32')).toBe('mac');
  });

  it('accepts only real platforms as a dev override', () => {
    expect(parsePlatformOverride('mac')).toBe('mac');
    expect(parsePlatformOverride('linux')).toBeNull();
    expect(parsePlatformOverride(null)).toBeNull();
  });
});
