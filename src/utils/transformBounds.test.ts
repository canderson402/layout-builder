import { describe, it, expect } from 'vitest';
import {
  transformPoint,
  inverseTransformPoint,
  transformedCorners,
  containsPoint,
} from './transformBounds';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('transformPoint', () => {
  it('is the identity for an untransformed component', () => {
    const p = transformPoint(10, 20, undefined, 100, 60);
    near(p.x, 10);
    near(p.y, 20);
  });

  it('rotates 90 degrees about the center', () => {
    const p = transformPoint(100, 30, { rotation: 90 }, 100, 60);
    near(p.x, 50);
    near(p.y, 80);
  });

  it('scales about the center', () => {
    const p = transformPoint(100, 30, { scale: 2 }, 100, 60);
    near(p.x, 150);
    near(p.y, 30);
  });

  it('rotates about an off-center origin', () => {
    const p = transformPoint(100, 0, { rotation: 90, origin: 'top-left' }, 100, 60);
    near(p.x, 0);
    near(p.y, 100);
  });
});

describe('inverseTransformPoint', () => {
  it('round-trips with transformPoint', () => {
    const t = { rotation: 37, scale: 1.4, origin: 'bottom-right' as const };
    const forward = transformPoint(23, 41, t, 100, 60);
    const back = inverseTransformPoint(forward.x, forward.y, t, 100, 60);
    near(back.x, 23);
    near(back.y, 41);
  });

  it('is the identity for an untransformed component', () => {
    const p = inverseTransformPoint(10, 20, undefined, 100, 60);
    near(p.x, 10);
    near(p.y, 20);
  });
});

describe('transformedCorners', () => {
  it('returns the plain rectangle for an untransformed component', () => {
    expect(transformedCorners(undefined, 100, 60)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ]);
  });

  it('returns four corners in order for a rotated component', () => {
    const corners = transformedCorners({ rotation: 90 }, 100, 60);
    expect(corners).toHaveLength(4);
    near(corners[0].x, 80);
    near(corners[0].y, -20);
  });
});

describe('containsPoint', () => {
  it('hits inside an untransformed component', () => {
    expect(containsPoint(50, 30, undefined, 100, 60)).toBe(true);
    expect(containsPoint(150, 30, undefined, 100, 60)).toBe(false);
  });

  it('hits a point that is only inside once rotation is accounted for', () => {
    expect(containsPoint(50, 5, { rotation: 90 }, 100, 60)).toBe(true);
  });

  it('misses a point inside the axis-aligned box but outside the rotated shape', () => {
    expect(containsPoint(2, 2, { rotation: 90 }, 100, 60)).toBe(false);
  });

  it('hits inside a scaled-up component beyond its original bounds', () => {
    expect(containsPoint(140, 30, { scale: 2 }, 100, 60)).toBe(true);
  });

  it('returns false for a scale of 0 even at the center point', () => {
    expect(containsPoint(50, 30, { scale: 0 }, 100, 60)).toBe(false);
  });

  it('returns false for a negative scale', () => {
    expect(containsPoint(50, 30, { scale: -1 }, 100, 60)).toBe(false);
  });

  it('returns false for a NaN scale', () => {
    expect(containsPoint(50, 30, { scale: NaN }, 100, 60)).toBe(false);
  });
});

describe('inverseTransformPoint degenerate scale', () => {
  it('returns finite numbers for a scale of 0', () => {
    const p = inverseTransformPoint(50, 30, { scale: 0 }, 100, 60);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('still round-trips normally for an ordinary scale', () => {
    const t = { rotation: 20, scale: 0.75 };
    const forward = transformPoint(15, 45, t, 100, 60);
    const back = inverseTransformPoint(forward.x, forward.y, t, 100, 60);
    near(back.x, 15);
    near(back.y, 45);
  });
});
