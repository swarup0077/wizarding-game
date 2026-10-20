import { describe, expect, it } from 'vitest';
import { createFpsMeter } from './fpsMeter';

const tickEvery = (
  meter: ReturnType<typeof createFpsMeter>,
  intervalMs: number,
  untilMs: number,
) => {
  for (let t = 0; t <= untilMs; t += intervalMs) meter.tick(t);
};

describe('fpsMeter', () => {
  it('reads 0 before two frames', () => {
    const meter = createFpsMeter(1000);
    expect(meter.read(0)).toBe(0);
    meter.tick(0);
    expect(meter.read(10)).toBe(0);
  });

  it('reads a steady 60 Hz as 60', () => {
    const meter = createFpsMeter(1000);
    tickEvery(meter, 1000 / 60, 3000);
    expect(meter.read(3000)).toBeCloseTo(60, 0);
  });

  it('reads a steady 25 Hz as 25', () => {
    const meter = createFpsMeter(1000);
    tickEvery(meter, 40, 2000);
    expect(meter.read(2000)).toBeCloseTo(25, 0);
  });

  it('drops during a stall instead of holding the last value', () => {
    const meter = createFpsMeter(1000);
    tickEvery(meter, 1000 / 60, 1000);
    expect(meter.read(1500)).toBeLessThan(40);
  });

  it('only counts frames inside the window', () => {
    const meter = createFpsMeter(1000);
    tickEvery(meter, 10, 1000); // 100 fps for a second...
    for (let t = 1040; t <= 3000; t += 40) meter.tick(t); // ...then 25 fps
    expect(meter.read(3000)).toBeCloseTo(25, 0);
  });
});
