import { describe, it, expect } from 'vitest';
import { Vertex, generatePath, normalizeColor } from './shapePath';
import {
  evalSegment, closestTOnSegment, insertVertexOnSegment,
  getShapeBounds, refitShapeGeometry, clampShapeData,
  sanitizeGradient, gradientCoords, resolveStopColor,
} from './shapePath';

type ShapeDataLike = { closed: boolean; vertices: Vertex[] };

const RECT: Vertex[] = [
  { x: 0, y: 0, type: 'corner' },
  { x: 1, y: 0, type: 'corner' },
  { x: 1, y: 1, type: 'corner' },
  { x: 0, y: 1, type: 'corner' },
];

describe('normalizeColor', () => {
  it('prepends # to bare 6-digit hex (TV game data sends colors without #)', () => {
    expect(normalizeColor('1f2a3b', '#000000')).toBe('#1f2a3b');
  });
  it('passes through #-prefixed and rgba colors', () => {
    expect(normalizeColor('#ff0000', '#000000')).toBe('#ff0000');
    expect(normalizeColor('rgba(0,0,0,0.5)', '#000000')).toBe('rgba(0,0,0,0.5)');
  });
  it('falls back when color is missing', () => {
    expect(normalizeColor(undefined, '#123456')).toBe('#123456');
  });
});

describe('generatePath', () => {
  it('generates a closed polygon path in pixel space', () => {
    expect(generatePath(RECT, true, 100, 50)).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
  });

  it('generates an open path without Z', () => {
    const line: Vertex[] = [
      { x: 0, y: 0.5, type: 'corner' },
      { x: 1, y: 0.5, type: 'corner' },
    ];
    expect(generatePath(line, false, 200, 20)).toBe('M 0 10 L 200 10');
  });

  it('emits a cubic segment when either endpoint has a handle facing it', () => {
    const verts: Vertex[] = [
      { x: 0, y: 1, type: 'smooth', hIn: { x: -0.2, y: 0 }, hOut: { x: 0.2, y: 0 } },
      { x: 1, y: 1, type: 'corner' },
    ];
    // c1 = a + hOut = (0.2, 1) -> (20, 100); c2 = b + (no hIn) = (100, 100)
    expect(generatePath(verts, false, 100, 100)).toBe('M 0 100 C 20 100, 100 100, 100 100');
  });

  it('falls back to a full-bounds rect for degenerate input', () => {
    expect(generatePath([], true, 10, 10)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    expect(generatePath([{ x: 0, y: 0, type: 'corner' }], true, 10, 10)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });

  it('survives NaN coordinates by treating them as 0', () => {
    const bad: Vertex[] = [
      { x: NaN as number, y: 0, type: 'corner' },
      { x: 1, y: 0, type: 'corner' },
      { x: 1, y: 1, type: 'corner' },
    ];
    expect(generatePath(bad, true, 10, 10)).toBe('M 0 0 L 10 0 L 10 10 Z');
  });

  it('closes with a curve when the wrap segment has handles', () => {
    const verts: Vertex[] = [
      { x: 0.5, y: 0, type: 'smooth', hIn: { x: -0.25, y: 0 }, hOut: { x: 0.25, y: 0 } },
      { x: 1, y: 1, type: 'corner' },
      { x: 0, y: 1, type: 'corner' },
    ];
    expect(generatePath(verts, true, 100, 100)).toBe(
      'M 50 0 C 75 0, 100 100, 100 100 L 0 100 C 0 100, 25 0, 50 0 Z'
    );
  });
});

// A symmetric "hump" curve: B(0.5) = (0.5, 0.75), peak y extremum 0.75 at t=0.5
const HUMP_A: Vertex = { x: 0, y: 0, type: 'broken', hOut: { x: 0, y: 1 } };
const HUMP_B: Vertex = { x: 1, y: 0, type: 'broken', hIn: { x: 0, y: 1 } };

describe('evalSegment', () => {
  it('evaluates straight segments by lerp', () => {
    const a: Vertex = { x: 0, y: 0, type: 'corner' };
    const b: Vertex = { x: 1, y: 1, type: 'corner' };
    expect(evalSegment(a, b, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
  it('evaluates cubic segments', () => {
    const p = evalSegment(HUMP_A, HUMP_B, 0.5);
    expect(p.x).toBeCloseTo(0.5, 5);
    expect(p.y).toBeCloseTo(0.75, 5);
  });
});

describe('closestTOnSegment', () => {
  it('finds the nearest t on a straight segment', () => {
    const a: Vertex = { x: 0, y: 0, type: 'corner' };
    const b: Vertex = { x: 1, y: 0, type: 'corner' };
    expect(closestTOnSegment(a, b, { x: 0.3, y: 0.2 })).toBeCloseTo(0.3, 2);
  });
});

describe('insertVertexOnSegment', () => {
  it('inserts a corner vertex at t on a straight segment', () => {
    const out = insertVertexOnSegment(RECT, true, 0, 0.5);
    expect(out).toHaveLength(5);
    expect(out[1]).toEqual({ x: 0.5, y: 0, type: 'corner' });
  });
  it('splits a cubic preserving the curve point and trimming neighbor handles', () => {
    const out = insertVertexOnSegment([HUMP_A, HUMP_B], false, 0, 0.5);
    expect(out).toHaveLength(3);
    expect(out[1].x).toBeCloseTo(0.5, 5);
    expect(out[1].y).toBeCloseTo(0.75, 5);
    expect(out[1].type).toBe('broken');
    expect(out[1].hIn).toBeDefined();
    expect(out[1].hOut).toBeDefined();
    // neighbor handles shrink (de Casteljau): a.hOut y goes 1 -> 0.5
    expect(out[0].hOut!.y).toBeCloseTo(0.5, 5);
    expect(out[2].hIn!.y).toBeCloseTo(0.5, 5);
  });
  it('inserts on the closing wrap segment of a closed shape', () => {
    const out = insertVertexOnSegment(RECT, true, 3, 0.5); // between last and first
    expect(out).toHaveLength(5);
    expect(out[4]).toEqual({ x: 0, y: 0.5, type: 'corner' });
  });
});

describe('getShapeBounds', () => {
  it('bounds plain polygons by their anchors', () => {
    expect(getShapeBounds(RECT, true)).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });
  it('includes bezier extrema beyond the anchors', () => {
    const b = getShapeBounds([HUMP_A, HUMP_B], false);
    expect(b.maxY).toBeCloseTo(0.75, 5);
    expect(b.minY).toBeCloseTo(0, 5);
  });
});

describe('refitShapeGeometry', () => {
  it('returns null when the shape already fills its bounds', () => {
    const shape: ShapeDataLike = { closed: true, vertices: RECT };
    expect(refitShapeGeometry(shape, { x: 100, y: 100 }, { width: 200, height: 100 })).toBeNull();
  });
  it('shrinks position/size to enclose and re-normalizes vertices', () => {
    const half: Vertex[] = RECT.map(v => ({ ...v, x: v.x * 0.5, y: v.y * 0.5 }));
    const result = refitShapeGeometry(
      { closed: true, vertices: half },
      { x: 100, y: 100 },
      { width: 200, height: 100 }
    )!;
    expect(result.position).toEqual({ x: 100, y: 100 });
    expect(result.size).toEqual({ width: 100, height: 50 });
    expect(result.shape.vertices[2].x).toBeCloseTo(1, 5);
    expect(result.shape.vertices[2].y).toBeCloseTo(1, 5);
  });
  it('grows bounds when a vertex was dragged outside', () => {
    const out: Vertex[] = [...RECT];
    out[2] = { x: 1.5, y: 1, type: 'corner' }; // dragged past the right edge
    const result = refitShapeGeometry(
      { closed: true, vertices: out },
      { x: 100, y: 100 },
      { width: 200, height: 100 }
    )!;
    expect(result.size.width).toBeCloseTo(300, 5);
    expect(result.position.x).toBeCloseTo(100, 5);
    expect(result.shape.vertices[2].x).toBeCloseTo(1, 5);
  });
});

describe('clampShapeData', () => {
  it('rejects degenerate shapes', () => {
    expect(clampShapeData(null)).toBeNull();
    expect(clampShapeData({ closed: true, vertices: RECT.slice(0, 2) })).toBeNull();
    expect(clampShapeData({ closed: false, vertices: RECT.slice(0, 1) })).toBeNull();
  });
  it('accepts a 2-vertex open path', () => {
    expect(clampShapeData({ closed: false, vertices: RECT.slice(0, 2) })).not.toBeNull();
  });
  it('clamps vertex coords to [0,1], handles to [-2,2], strips corner handles', () => {
    const dirty = {
      closed: true,
      vertices: [
        { x: -0.5, y: 0, type: 'corner', hOut: { x: 1, y: 1 } }, // corner handle -> stripped
        { x: 2, y: 0, type: 'smooth', hIn: { x: -9, y: 0 }, hOut: { x: 9, y: 0 } },
        { x: 0.5, y: 1, type: 'weird' }, // bad type -> corner
      ],
    };
    const clean = clampShapeData(dirty)!;
    expect(clean.vertices[0]).toEqual({ x: 0, y: 0, type: 'corner' });
    expect(clean.vertices[1].x).toBe(1);
    expect(clean.vertices[1].hIn).toEqual({ x: -2, y: 0 });
    expect(clean.vertices[1].hOut).toEqual({ x: 2, y: 0 });
    expect(clean.vertices[2].type).toBe('corner');
  });
});

describe('sanitizeGradient', () => {
  it('rejects gradients with fewer than 2 valid stops', () => {
    expect(sanitizeGradient(null)).toBeNull();
    expect(sanitizeGradient({ type: 'linear', stops: [{ offset: 0, color: '#fff' }] })).toBeNull();
  });
  it('clamps and sorts stops', () => {
    const g = sanitizeGradient({
      type: 'linear', angle: 45,
      stops: [{ offset: 1.5, color: '#222' }, { offset: -1, color: '#111' }],
    })!;
    expect(g.stops[0]).toEqual({ offset: 0, color: '#111' });
    expect(g.stops[1]).toEqual({ offset: 1, color: '#222' });
  });
  it('preserves valid per-stop team bindings and drops invalid ones', () => {
    const g = sanitizeGradient({
      type: 'linear', angle: 0,
      stops: [
        { offset: 0, color: '#111', teamColor: 'home' },
        { offset: 0.5, color: '#333', teamColor: 'nonsense' },
        { offset: 1, color: '#222', teamColor: 'away' },
      ],
    })!;
    expect(g.stops[0].teamColor).toBe('home');
    expect(g.stops[1].teamColor).toBeUndefined();
    expect(g.stops[2].teamColor).toBe('away');
  });
});

describe('resolveStopColor', () => {
  it('resolves team-bound stops from game colors, normalizing bare hex', () => {
    expect(resolveStopColor({ offset: 0, color: '#111111', teamColor: 'home' }, '1f2a3b', 'aabbcc')).toBe('#1f2a3b');
    expect(resolveStopColor({ offset: 0, color: '#111111', teamColor: 'away' }, '1f2a3b', 'aabbcc')).toBe('#aabbcc');
  });
  it('falls back to the stored color when the team color is unavailable', () => {
    expect(resolveStopColor({ offset: 0, color: '#111111', teamColor: 'home' }, undefined, undefined)).toBe('#111111');
  });
  it('uses the stored color for unbound stops', () => {
    expect(resolveStopColor({ offset: 0, color: '#111111' }, '1f2a3b', 'aabbcc')).toBe('#111111');
  });
});

describe('gradientCoords', () => {
  it('maps 0deg to left->right', () => {
    const c = gradientCoords(0);
    expect(c.x1).toBeCloseTo(0, 5);
    expect(c.x2).toBeCloseTo(1, 5);
    expect(c.y1).toBeCloseTo(0.5, 5);
  });
  it('maps 90deg to top->bottom', () => {
    const c = gradientCoords(90);
    expect(c.y1).toBeCloseTo(0, 5);
    expect(c.y2).toBeCloseTo(1, 5);
  });
});
