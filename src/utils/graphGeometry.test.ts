import { describe, expect, it } from 'vitest';
import type { AnimationTrack, Keyframe } from '../shared/utils/overlayTimeline';
import {
  FALLBACK_RANGE,
  buildCurvePath,
  computeValueRange,
  handleFromPoint,
  handlePoint,
  nearestCurvePoint,
  panRange,
  valuePerPixel,
  valueToY,
  yToValue,
  zoomRange,
} from './graphGeometry';

const kf = (frame: number, value: number | string, extra: Partial<Keyframe> = {}): Keyframe => ({
  frame,
  value,
  interpolation: 'linear',
  ...extra,
});

const track = (keyframes: Keyframe[]): AnimationTrack => ({
  componentId: 'c1',
  property: 'x',
  keyframes,
});

describe('computeValueRange', () => {
  it('spans the keyframe values with padding', () => {
    const range = computeValueRange([track([kf(0, 0), kf(10, 100)])], 0.1);
    expect(range.min).toBeCloseTo(-10, 6);
    expect(range.max).toBeCloseTo(110, 6);
  });

  it('includes bezier handle tips so a dragged handle stays visible', () => {
    const range = computeValueRange([track([
      kf(0, 0, { interpolation: 'bezier', handleOut: { dFrame: 3, dValue: 500 } }),
      kf(10, 10),
    ])], 0);
    expect(range.max).toBeGreaterThanOrEqual(500);
  });

  it('pads a flat channel so it does not collapse to zero height', () => {
    const range = computeValueRange([track([kf(0, 5), kf(10, 5)])]);
    expect(range.max).toBeGreaterThan(range.min);
  });

  it('falls back when there are no numeric values', () => {
    expect(computeValueRange([])).toEqual(FALLBACK_RANGE);
    expect(computeValueRange([track([kf(0, '#ff0000')])])).toEqual(FALLBACK_RANGE);
  });

  it('ignores non-finite handle values', () => {
    const range = computeValueRange([track([
      kf(0, 0, { handleOut: { dFrame: 1, dValue: NaN } }),
      kf(10, 10),
    ])], 0);
    expect(range.max).toBe(10);
  });
});

describe('value axis mapping', () => {
  const range = { min: 0, max: 100 };

  it('puts the maximum at the top and the minimum at the bottom', () => {
    expect(valueToY(100, range, 200)).toBe(0);
    expect(valueToY(0, range, 200)).toBe(200);
  });

  it('round-trips through yToValue', () => {
    for (const value of [0, 25, 50, 99.5]) {
      expect(yToValue(valueToY(value, range, 200), range, 200)).toBeCloseTo(value, 6);
    }
  });

  it('survives a zero-span range without dividing by zero', () => {
    expect(valueToY(5, { min: 5, max: 5 }, 100)).toBe(50);
  });
});

describe('handle screen mapping', () => {
  const range = { min: 0, max: 100 };
  const key = kf(10, 50, { interpolation: 'bezier', handleOut: { dFrame: 5, dValue: 25 } });

  it('places a handle at its frame/value offset', () => {
    const point = handlePoint(key, key.handleOut, range, 200, 4, 0)!;
    expect(point.x).toBe(60);
    expect(point.y).toBe(valueToY(75, range, 200));
  });

  it('round-trips a handle through screen space', () => {
    const point = handlePoint(key, key.handleOut, range, 200, 4, 0)!;
    const back = handleFromPoint(key, point, range, 200, 4, 0)!;
    expect(back.dFrame).toBeCloseTo(5, 6);
    expect(back.dValue).toBeCloseTo(25, 6);
  });

  it('returns null for a missing handle or a non-numeric keyframe', () => {
    expect(handlePoint(key, undefined, range, 200, 4, 0)).toBeNull();
    expect(handlePoint(kf(0, '#fff'), { dFrame: 1, dValue: 1 }, range, 200, 4, 0)).toBeNull();
  });

  it('accounts for the frame offset when scrolled', () => {
    const point = handlePoint(key, key.handleOut, range, 200, 4, 10)!;
    expect(point.x).toBe(20);
  });
});

describe('buildCurvePath', () => {
  const range = { min: 0, max: 100 };

  it('draws a straight line between linear keyframes', () => {
    const path = buildCurvePath([kf(0, 0), kf(10, 100)], range, 100, 4, 0);
    expect(path).toBe('M 0 100 L 40 0');
  });

  it('emits a cubic segment for a bezier keyframe', () => {
    const path = buildCurvePath([
      kf(0, 0, { interpolation: 'bezier', handleOut: { dFrame: 3, dValue: 30 } }),
      kf(10, 100, { handleIn: { dFrame: -3, dValue: -30 } }),
    ], range, 100, 4, 0);
    expect(path).toContain(' C ');
  });

  it('steps for a constant keyframe', () => {
    const path = buildCurvePath([kf(0, 0, { interpolation: 'constant' }), kf(10, 100)], range, 100, 4, 0);
    expect(path).toBe('M 0 100 L 40 100 L 40 0');
  });

  it('returns an empty path when nothing is numeric', () => {
    expect(buildCurvePath([kf(0, '#fff')], range, 100, 4, 0)).toBe('');
    expect(buildCurvePath([], range, 100, 4, 0)).toBe('');
  });

  it('skips non-numeric keyframes rather than breaking the path', () => {
    const path = buildCurvePath([kf(0, 0), kf(5, '#fff'), kf(10, 100)], range, 100, 4, 0);
    expect(path).toBe('M 0 100 L 40 0');
  });
});

describe('zoomRange', () => {
  const range = { min: 0, max: 100 };

  it('keeps the focus value pinned while zooming in', () => {
    const zoomed = zoomRange(range, 25, 0.5);
    expect(zoomed.max - zoomed.min).toBeCloseTo(50, 6);
    expect(yToValue(valueToY(25, zoomed, 200), zoomed, 200)).toBeCloseTo(25, 6);
    expect(valueToY(25, zoomed, 200)).toBeCloseTo(valueToY(25, range, 200), 6);
  });

  it('zooms out symmetrically about the focus', () => {
    const zoomed = zoomRange(range, 50, 2);
    expect(zoomed.min).toBeCloseTo(-50, 6);
    expect(zoomed.max).toBeCloseTo(150, 6);
  });

  it('refuses to collapse or explode the span', () => {
    const tiny = zoomRange(range, 50, 1e-12);
    expect(tiny.max - tiny.min).toBeGreaterThan(0);
    const huge = zoomRange(range, 50, 1e12);
    expect(Number.isFinite(huge.max - huge.min)).toBe(true);
  });

  it('ignores a nonsense factor', () => {
    expect(zoomRange(range, 50, 0)).toBe(range);
    expect(zoomRange(range, 50, NaN)).toBe(range);
  });
});

describe('panRange', () => {
  it('shifts without changing the span', () => {
    const panned = panRange({ min: 0, max: 100 }, 25);
    expect(panned).toEqual({ min: 25, max: 125 });
  });

  it('ignores a non-finite delta', () => {
    const range = { min: 0, max: 100 };
    expect(panRange(range, NaN)).toBe(range);
  });
});

describe('valuePerPixel', () => {
  it('reports the drag sensitivity', () => {
    expect(valuePerPixel({ min: 0, max: 150 }, 150)).toBe(1);
    expect(valuePerPixel({ min: 0, max: 1920 }, 150)).toBeCloseTo(12.8, 6);
  });

  it('is zero for a collapsed viewport', () => {
    expect(valuePerPixel({ min: 0, max: 100 }, 0)).toBe(0);
  });
});

describe('nearestCurvePoint', () => {
  const range = { min: 0, max: 100 };
  const opts = { range, height: 100, pixelsPerFrame: 4, originFrame: 0 };
  const ramp = track([kf(0, 0), kf(10, 100)]);

  it('finds the curve when the pointer is right on it', () => {
    // frame 5 -> value 50 -> x=20, y=50
    const hit = nearestCurvePoint([ramp], 20, 50, opts)!;
    expect(hit.distance).toBeLessThan(2);
    expect(hit.frame).toBeCloseTo(5, 1);
  });

  it('still finds a STEEP curve that a vertical-only test would miss', () => {
    // 100 value units over 40px is steep; pointer 6px to the left of the line
    const steep = track([kf(0, 0), kf(5, 100)]);
    const hit = nearestCurvePoint([steep], 14, 50, { ...opts })!;
    expect(hit.distance).toBeLessThan(8);
  });

  it('reports a large distance when the pointer is nowhere near', () => {
    // flat curve at value 90 (y = 10); pointer near the bottom of the view
    const flat = track([kf(0, 90), kf(10, 90)]);
    const hit = nearestCurvePoint([flat], 20, 95, opts)!;
    expect(hit.distance).toBeGreaterThan(80);
  });

  it('picks the closest of several curves', () => {
    const low = track([kf(0, 10), kf(10, 10)]);
    const high = { ...track([kf(0, 90), kf(10, 90)]), property: 'y' as const };
    const hit = nearestCurvePoint([low, high], 20, valueToY(88, range, 100), opts)!;
    expect(hit.value).toBeCloseTo(90, 6);
  });

  it('returns null for no tracks or a collapsed scale', () => {
    expect(nearestCurvePoint([], 10, 10, opts)).toBeNull();
    expect(nearestCurvePoint([ramp], 10, 10, { ...opts, pixelsPerFrame: 0 })).toBeNull();
  });

  it('skips non-numeric channels', () => {
    const colour = { ...track([kf(0, '#000000'), kf(10, '#ffffff')]), property: 'color' as const };
    expect(nearestCurvePoint([colour], 20, 50, opts)).toBeNull();
  });
});
