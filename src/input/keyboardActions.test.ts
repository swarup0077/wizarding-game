import { describe, expect, it } from 'vitest';
import { actionForKey, type KeyPress } from './keyboardActions';

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  typing: false,
  ...extra,
});

describe('keyboardActions', () => {
  it('P (either case) toggles the preview', () => {
    expect(actionForKey(press('p'))).toBe('preview.toggle');
    expect(actionForKey(press('P'))).toBe('preview.toggle');
  });

  it('ignores repeats, modifier shortcuts and typing', () => {
    expect(actionForKey(press('p', { repeat: true }))).toBeNull();
    expect(actionForKey(press('p', { ctrlKey: true }))).toBeNull(); // Ctrl+P prints
    expect(actionForKey(press('p', { metaKey: true }))).toBeNull();
    expect(actionForKey(press('p', { altKey: true }))).toBeNull();
    expect(actionForKey(press('p', { typing: true }))).toBeNull();
  });

  it('ignores keys without a shortcut (D stays with the debug overlay)', () => {
    expect(actionForKey(press('d'))).toBeNull();
    expect(actionForKey(press('Enter'))).toBeNull();
  });
});
