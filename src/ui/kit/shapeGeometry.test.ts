import { describe, expect, it } from 'vitest';
import { shapeGeometry } from './shapeGeometry';

const circle = Array.from({ length: 121 }, (_, i) => {
  const t = -Math.PI / 2 + (i / 120) * Math.PI * 2;
  return { x: 0.5 + 0.5 * Math.cos(t), y: 0.5 + 0.5 * Math.sin(t) };
});

describe('shapeGeometry', () => {
  it('places the shape inside the padded box and starts the path at the start dot', () => {
    const g = shapeGeometry(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      100,
      10,
    );
    expect(g.d).toBe('M10.0 10.0 L90.0 90.0');
    expect(g.start).toEqual({ x: 10, y: 10 });
  });

  it('points the arrow along the stroke, early on (a clockwise circle from the top heads right)', () => {
    const g = shapeGeometry(circle, 160, 16);
    expect(g.arrow.x).toBeGreaterThan(g.start.x);
    expect(g.arrow.angleDeg).toBeGreaterThan(0);
    expect(g.arrow.angleDeg).toBeLessThan(90);
  });
});
