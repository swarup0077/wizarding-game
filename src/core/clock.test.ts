import { describe, expect, it } from 'vitest';
import { createFakeClock, systemClock } from './clock';

describe('clock', () => {
  it('fake clock starts where told and moves only when asked', () => {
    const clock = createFakeClock(100);
    expect(clock.now()).toBe(100);
    clock.advance(250);
    expect(clock.now()).toBe(350);
    clock.set(10);
    expect(clock.now()).toBe(10);
  });

  it('fake clock defaults to zero', () => {
    expect(createFakeClock().now()).toBe(0);
  });

  it('system clock never goes backwards', () => {
    const first = systemClock.now();
    expect(systemClock.now()).toBeGreaterThanOrEqual(first);
  });
});
