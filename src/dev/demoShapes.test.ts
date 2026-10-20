import { describe, expect, it } from 'vitest';
import { type DemoShape, demoShapes, pointAlong } from './demoShapes';

const shape = (name: DemoShape['name']): DemoShape => {
  const found = demoShapes.find((s) => s.name === name);
  if (!found) throw new Error(`missing ${name}`);
  return found;
};

describe('demo shapes', () => {
  it('start and end where FR-10 says', () => {
    expect(pointAlong(shape('circle'), 0).x).toBeCloseTo(0.5);
    expect(pointAlong(shape('circle'), 0).y).toBeCloseTo(0);
    expect(pointAlong(shape('zigzag'), 0)).toEqual({ x: 0.5, y: 1 });
    expect(pointAlong(shape('zigzag'), 1).x).toBeCloseTo(0.6);
    expect(pointAlong(shape('zigzag'), 1).y).toBeCloseTo(0);
    expect(pointAlong(shape('swish'), 0)).toEqual({ x: 0, y: 0.25 });
    expect(pointAlong(shape('swish'), 1).x).toBeCloseTo(1);
    expect(pointAlong(shape('swish'), 1).y).toBeCloseTo(0.05);
  });

  it('moves at even speed along the path (arc length)', () => {
    const quarter = pointAlong(shape('circle'), 0.25);
    expect(quarter.x).toBeCloseTo(1, 2);
    expect(quarter.y).toBeCloseTo(0.5, 2);
  });
});
