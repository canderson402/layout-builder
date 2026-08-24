import { describe, it, expect } from 'vitest';
import {
  AnimationTrack,
  Keyframe,
  sortKeyframes,
  sampleTrack,
  sampleTracks,
  mixHexColors,
  findTrack,
  insertKeyframe,
  insertKeyframeOnCurve,
  autoHandles,
  counterpartHandle,
  mirrorHandle,
  setKeyframeHandle,
  setKeyframeHandleMode,
  setKeyframeInterpolation,
  setKeyframeEasing,
  setKeyframeValue,
  removeKeyframe,
  retimeKeyframe,
  pruneTracksForComponent,
  validateTracks,
} from './overlayTimeline';

const kf = (frame: number, value: number | string, interpolation: 'linear' | 'bezier' | 'constant' = 'linear'): Keyframe =>
  ({ frame, value, interpolation });

const track = (property: any, keyframes: Keyframe[], componentId = 'c1'): AnimationTrack =>
  ({ componentId, property, keyframes });

describe('sortKeyframes', () => {
  it('sorts ascending by frame without mutating the input', () => {
    const input = [kf(10, 1), kf(0, 0), kf(5, 2)];
    const out = sortKeyframes(input);
    expect(out.map(k => k.frame)).toEqual([0, 5, 10]);
    expect(input.map(k => k.frame)).toEqual([10, 0, 5]);
  });
});

describe('sampleTrack', () => {
  it('returns undefined for an empty track', () => {
    expect(sampleTrack(track('x', []), 5)).toBeUndefined();
  });

  it('holds the only keyframe everywhere', () => {
    const t = track('x', [kf(10, 42)]);
    expect(sampleTrack(t, 0)).toBe(42);
    expect(sampleTrack(t, 10)).toBe(42);
    expect(sampleTrack(t, 999)).toBe(42);
  });

  it('holds the first value before the first keyframe', () => {
    const t = track('x', [kf(10, 100), kf(20, 200)]);
    expect(sampleTrack(t, 0)).toBe(100);
    expect(sampleTrack(t, 9.99)).toBe(100);
  });

  it('holds the last value after the last keyframe', () => {
    const t = track('x', [kf(10, 100), kf(20, 200)]);
    expect(sampleTrack(t, 20)).toBe(200);
    expect(sampleTrack(t, 1000)).toBe(200);
  });

  it('interpolates linearly between two keyframes', () => {
    const t = track('x', [kf(0, 0), kf(10, 100)]);
    expect(sampleTrack(t, 5)).toBeCloseTo(50, 10);
    expect(sampleTrack(t, 2.5)).toBeCloseTo(25, 10);
  });

  it('handles a fractional frame', () => {
    const t = track('opacity', [kf(0, 0), kf(3, 1)]);
    expect(sampleTrack(t, 1.5)).toBeCloseTo(0.5, 10);
  });

  it('picks the correct segment among many keyframes', () => {
    const t = track('x', [kf(0, 0), kf(10, 100), kf(20, 0), kf(30, 50)]);
    expect(sampleTrack(t, 15)).toBeCloseTo(50, 10);
    expect(sampleTrack(t, 25)).toBeCloseTo(25, 10);
  });

  it('returns the exact value when the frame lands on a keyframe', () => {
    const t = track('x', [kf(0, 0), kf(10, 100), kf(20, 0)]);
    expect(sampleTrack(t, 10)).toBe(100);
  });

  it('holds the left value across a constant segment', () => {
    const t = track('x', [kf(0, 0, 'constant'), kf(10, 100)]);
    expect(sampleTrack(t, 1)).toBe(0);
    expect(sampleTrack(t, 9.99)).toBe(0);
    expect(sampleTrack(t, 10)).toBe(100);
  });

  it('reads interpolation from the LEFT keyframe of the segment', () => {
    const t = track('x', [kf(0, 0, 'linear'), kf(10, 100, 'constant'), kf(20, 200)]);
    expect(sampleTrack(t, 5)).toBeCloseTo(50, 10);
    expect(sampleTrack(t, 15)).toBe(100);
  });

  it('does not divide by zero if two keyframes share a frame', () => {
    const t = track('x', [kf(0, 0), kf(0, 50), kf(10, 100)]);
    const v = sampleTrack(t, 0);
    expect(Number.isFinite(v as number)).toBe(true);
  });

  it('coerces a non-finite frame to 0 rather than returning NaN', () => {
    const t = track('x', [kf(0, 10), kf(10, 100)]);
    expect(sampleTrack(t, Number.NaN)).toBe(10);
    expect(sampleTrack(t, Number.POSITIVE_INFINITY)).toBe(10);
    expect(sampleTrack(t, Number.NEGATIVE_INFINITY)).toBe(10);
  });
});

describe('bezier interpolation', () => {
  const bez = (frame: number, value: number, out?: { dFrame: number; dValue: number }, inn?: { dFrame: number; dValue: number }): Keyframe =>
    ({ frame, value, interpolation: 'bezier', handleOut: out, handleIn: inn });

  it('degenerates to linear when both handles are absent', () => {
    const t = track('x', [bez(0, 0), bez(10, 100)]);
    expect(sampleTrack(t, 5)).toBeCloseTo(50, 6);
  });

  it('is exactly linear at the midpoint when both handles are absent', () => {
    const t = track('x', [bez(0, 0), bez(10, 100)]);
    expect(sampleTrack(t, 5)).toBe(50);
  });

  it('is exactly linear at a non-midpoint frame when both handles are absent', () => {
    const t = track('x', [bez(0, 0), bez(10, 100)]);
    expect(sampleTrack(t, 3)).toBe(30);
  });

  it('hits both endpoints exactly', () => {
    const t = track('x', [bez(0, 0, { dFrame: 4, dValue: 0 }), bez(10, 100, undefined, { dFrame: -4, dValue: 0 })]);
    expect(sampleTrack(t, 0)).toBeCloseTo(0, 9);
    expect(sampleTrack(t, 10)).toBeCloseTo(100, 9);
  });

  it('matches the CSS ease curve within tolerance', () => {
    const t = track('x', [
      bez(0, 0, { dFrame: 2.5, dValue: 10 }),
      bez(10, 100, undefined, { dFrame: -1.9, dValue: 0 }),
    ]);
    const v = sampleTrack(t, 5) as number;
    expect(v).toBeGreaterThan(50);
    expect(v).toBeLessThan(90);
  });

  it('ease-out style handles produce a value above the linear midpoint', () => {
    const t = track('x', [
      bez(0, 0, { dFrame: 0, dValue: 60 }),
      bez(10, 100, undefined, { dFrame: 0, dValue: 0 }),
    ]);
    expect(sampleTrack(t, 5) as number).toBeGreaterThan(50);
  });

  it('ease-in style handles produce a value below the linear midpoint', () => {
    const t = track('x', [
      bez(0, 0, { dFrame: 0, dValue: 0 }),
      bez(10, 100, undefined, { dFrame: 0, dValue: -60 }),
    ]);
    expect(sampleTrack(t, 5) as number).toBeLessThan(50);
  });

  it('is monotonic in time even when a handle overshoots the segment', () => {
    const t = track('x', [
      bez(0, 0, { dFrame: 999, dValue: 0 }),
      bez(10, 100, undefined, { dFrame: -999, dValue: 0 }),
    ]);
    let prev = sampleTrack(t, 0) as number;
    for (let f = 0.5; f <= 10; f += 0.5) {
      const v = sampleTrack(t, f) as number;
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
    expect(prev).toBeCloseTo(100, 6);
  });

  it('never returns NaN for handles with non-finite values', () => {
    const t = track('x', [
      bez(0, 0, { dFrame: Number.NaN, dValue: Number.NaN }),
      bez(10, 100, undefined, { dFrame: Number.NaN, dValue: Number.NaN }),
    ]);
    const v = sampleTrack(t, 5) as number;
    expect(Number.isFinite(v)).toBe(true);
  });

  it('still holds before the first and after the last keyframe', () => {
    const t = track('x', [bez(10, 100, { dFrame: 2, dValue: 5 }), bez(20, 200)]);
    expect(sampleTrack(t, 0)).toBe(100);
    expect(sampleTrack(t, 99)).toBe(200);
  });
});

describe('sampleTracks', () => {
  it('returns an empty map for no tracks', () => {
    expect(sampleTracks([], 0).size).toBe(0);
  });

  it('omits components that have no tracks', () => {
    const out = sampleTracks([track('x', [kf(0, 5)], 'c1')], 0);
    expect(out.has('c1')).toBe(true);
    expect(out.has('c2')).toBe(false);
  });

  it('sets only channels that have a track, leaving the rest undefined', () => {
    const out = sampleTracks([track('x', [kf(0, 25)], 'c1')], 0);
    expect(out.get('c1')).toEqual({ x: 25 });
  });

  it('merges multiple tracks for one component', () => {
    const out = sampleTracks([
      track('x', [kf(0, 0), kf(10, 100)], 'c1'),
      track('opacity', [kf(0, 0), kf(10, 1)], 'c1'),
    ], 5);
    const v = out.get('c1')!;
    expect(v.x).toBeCloseTo(50, 10);
    expect(v.opacity).toBeCloseTo(0.5, 10);
    expect(v.scale).toBeUndefined();
  });

  it('keeps components independent', () => {
    const out = sampleTracks([
      track('rotation', [kf(0, 0), kf(10, 90)], 'c1'),
      track('rotation', [kf(0, 0), kf(10, -90)], 'c2'),
    ], 10);
    expect(out.get('c1')!.rotation).toBeCloseTo(90, 10);
    expect(out.get('c2')!.rotation).toBeCloseTo(-90, 10);
  });

  it('ignores a track whose keyframes are empty', () => {
    const out = sampleTracks([track('x', [], 'c1')], 0);
    expect(out.has('c1')).toBe(false);
  });

  it('produces finite values for every channel when frame is NaN', () => {
    const out = sampleTracks([
      track('x', [kf(0, 0), kf(10, 100)], 'c1'),
      track('y', [kf(0, 0), kf(10, 100)], 'c1'),
      track('scale', [kf(0, 1), kf(10, 2)], 'c1'),
      track('rotation', [kf(0, 0), kf(10, 90)], 'c1'),
      track('opacity', [kf(0, 0), kf(10, 1)], 'c1'),
    ], Number.NaN);
    const v = out.get('c1')!;
    expect(Number.isFinite(v.x)).toBe(true);
    expect(Number.isFinite(v.y)).toBe(true);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(Number.isFinite(v.rotation)).toBe(true);
    expect(Number.isFinite(v.opacity)).toBe(true);
  });

  it('drops a color track whose keyframe values are numbers instead of strings', () => {
    const out = sampleTracks([track('color', [kf(0, 1), kf(10, 2)], 'c1')], 5);
    expect(out.get('c1')).toEqual({});
  });

  it('ignores an x track whose keyframe values are strings', () => {
    const out = sampleTracks([track('x', [kf(0, 'a'), kf(10, 'b')], 'c1')], 5);
    const v = out.get('c1')!;
    expect(v).toEqual({});
    expect(v.x).toBeUndefined();
  });
});

describe('mixHexColors', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('mixes channel by channel', () => {
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHexColors('#ff0000', '#0000ff', 0.5)).toBe('#800080');
  });

  it('accepts shorthand and missing hash', () => {
    expect(mixHexColors('#000', '#fff', 1)).toBe('#ffffff');
    expect(mixHexColors('000000', 'ffffff', 0)).toBe('#000000');
  });

  it('is case insensitive', () => {
    expect(mixHexColors('#FF0000', '#FF0000', 0.5)).toBe('#ff0000');
  });

  it('clamps t outside 0..1', () => {
    expect(mixHexColors('#000000', '#ffffff', -1)).toBe('#000000');
    expect(mixHexColors('#000000', '#ffffff', 2)).toBe('#ffffff');
  });

  it('degrades rather than throwing on unparseable input', () => {
    expect(mixHexColors('nonsense', '#ffffff', 0.9)).toBe('#ffffff');
    expect(mixHexColors('nonsense', '#ffffff', 0.1)).toBe('#ffffff');
  });

  it('returns the parseable end when only b is unparseable', () => {
    expect(mixHexColors('#ffffff', 'nonsense', 0.9)).toBe('#ffffff');
    expect(mixHexColors('#ffffff', 'nonsense', 0.1)).toBe('#ffffff');
  });

  it('falls back to the nearer-endpoint rule when both ends are unparseable', () => {
    expect(mixHexColors('nonsense', 'garbage', 0.9)).toBe('garbage');
    expect(mixHexColors('nonsense', 'garbage', 0.1)).toBe('nonsense');
  });
});

describe('color tracks', () => {
  const ckf = (frame: number, value: string, interpolation: 'linear' | 'constant' | 'bezier' = 'linear'): Keyframe =>
    ({ frame, value, interpolation });

  it('interpolates a color track linearly', () => {
    const out = sampleTracks([track('color', [ckf(0, '#000000'), ckf(10, '#ffffff')], 'c1')], 5);
    expect(out.get('c1')!.color).toBe('#808080');
  });

  it('holds across a constant color segment', () => {
    const out = sampleTracks([track('color', [ckf(0, '#ff0000', 'constant'), ckf(10, '#0000ff')], 'c1')], 9);
    expect(out.get('c1')!.color).toBe('#ff0000');
  });

  it('treats bezier on a color track as linear', () => {
    const out = sampleTracks([track('backgroundColor', [ckf(0, '#000000', 'bezier'), ckf(10, '#ffffff')], 'c1')], 5);
    expect(out.get('c1')!.backgroundColor).toBe('#808080');
  });

  it('leaves color undefined when the component has no color track', () => {
    const out = sampleTracks([track('x', [kf(0, 1)], 'c1')], 0);
    expect(out.get('c1')!.color).toBeUndefined();
  });

  it('returns the exact keyframe color when sampled on the keyframe frame', () => {
    const out = sampleTracks([track('color', [ckf(0, '#123456'), ckf(10, '#abcdef')], 'c1')], 10);
    expect(out.get('c1')!.color).toBe('#abcdef');
  });
});

describe('findTrack', () => {
  it('finds the matching track by componentId and property', () => {
    const t1 = track('x', [kf(0, 1)], 'c1');
    const t2 = track('y', [kf(0, 2)], 'c1');
    const t3 = track('x', [kf(0, 3)], 'c2');
    expect(findTrack([t1, t2, t3], 'c1', 'y')).toBe(t2);
  });

  it('returns undefined when no track matches', () => {
    const t1 = track('x', [kf(0, 1)], 'c1');
    expect(findTrack([t1], 'c1', 'y')).toBeUndefined();
    expect(findTrack([t1], 'c2', 'x')).toBeUndefined();
  });
});

describe('insertKeyframe', () => {
  it('creates a track when none exists for the property', () => {
    const out = insertKeyframe([], 'c1', 'x', kf(5, 10));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ componentId: 'c1', property: 'x', keyframes: [kf(5, 10)] });
  });

  it('creates a second track for the same component when property differs', () => {
    const existing = [track('x', [kf(0, 1)], 'c1')];
    const out = insertKeyframe(existing, 'c1', 'y', kf(5, 10));
    expect(out).toHaveLength(2);
    expect(out.find(t => t.property === 'x')!.keyframes).toEqual([kf(0, 1)]);
    expect(out.find(t => t.property === 'y')!.keyframes).toEqual([kf(5, 10)]);
  });

  it('inserts into an empty track list, producing a sorted result on later inserts', () => {
    let out = insertKeyframe([], 'c1', 'x', kf(10, 1));
    out = insertKeyframe(out, 'c1', 'x', kf(0, 0));
    out = insertKeyframe(out, 'c1', 'x', kf(5, 2));
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 5, 10]);
  });

  it('replaces an existing keyframe at the same frame rather than stacking a duplicate', () => {
    const existing = [track('x', [kf(0, 1), kf(10, 2)], 'c1')];
    const out = insertKeyframe(existing, 'c1', 'x', kf(10, 99));
    const t = out.find(tr => tr.property === 'x')!;
    expect(t.keyframes).toHaveLength(2);
    expect(t.keyframes.map(k => k.frame)).toEqual([0, 10]);
    expect(t.keyframes.find(k => k.frame === 10)!.value).toBe(99);
  });

  it('does not mutate the input tracks array or its track objects', () => {
    const originalKeyframes = [kf(0, 1)];
    const originalTrack = track('x', originalKeyframes, 'c1');
    const input = [originalTrack];
    const out = insertKeyframe(input, 'c1', 'x', kf(5, 2));

    expect(input).toHaveLength(1);
    expect(input[0]).toBe(originalTrack);
    expect(originalTrack.keyframes).toBe(originalKeyframes);
    expect(originalKeyframes).toEqual([kf(0, 1)]);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(originalTrack);
  });
});

describe('removeKeyframe', () => {
  it('removes the keyframe at the given frame, keeping the track sorted', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2), kf(10, 3)], 'c1')];
    const out = removeKeyframe(existing, 'c1', 'x', 5);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 10]);
  });

  it('removes the whole track when removing its last keyframe', () => {
    const existing = [track('x', [kf(0, 1)], 'c1'), track('y', [kf(0, 2)], 'c1')];
    const out = removeKeyframe(existing, 'c1', 'x', 0);
    expect(out).toHaveLength(1);
    expect(out[0].property).toBe('y');
  });

  it('is a no-op when the track does not exist', () => {
    const existing = [track('x', [kf(0, 1)], 'c1')];
    const out = removeKeyframe(existing, 'c2', 'x', 0);
    expect(out).toEqual(existing);
  });

  it('is a no-op when the frame does not exist on the track', () => {
    const existing = [track('x', [kf(0, 1), kf(10, 2)], 'c1')];
    const out = removeKeyframe(existing, 'c1', 'x', 5);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 10]);
  });

  it('does not mutate the input', () => {
    const originalKeyframes = [kf(0, 1), kf(5, 2)];
    const originalTrack = track('x', originalKeyframes, 'c1');
    const input = [originalTrack];
    removeKeyframe(input, 'c1', 'x', 5);

    expect(input[0]).toBe(originalTrack);
    expect(originalTrack.keyframes).toBe(originalKeyframes);
    expect(originalKeyframes.map(k => k.frame)).toEqual([0, 5]);
  });
});

describe('retimeKeyframe', () => {
  it('moves a keyframe to a new frame, keeping the track sorted', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2), kf(10, 3)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 8);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 8, 10]);
    expect(out[0].keyframes.find(k => k.frame === 8)!.value).toBe(2);
  });

  it('replaces the occupant when dropped onto an occupied frame', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2), kf(10, 3)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 10);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 10]);
    expect(out[0].keyframes.find(k => k.frame === 10)!.value).toBe(2);
  });

  it('rounds the target frame to an integer', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 7.6);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 8]);
  });

  it('is a no-op when the track does not exist', () => {
    const existing = [track('x', [kf(0, 1)], 'c1')];
    const out = retimeKeyframe(existing, 'c2', 'x', 0, 5);
    expect(out).toEqual(existing);
  });

  it('is a no-op when the source frame does not exist on the track', () => {
    const existing = [track('x', [kf(0, 1), kf(10, 2)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 8);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 10]);
  });

  it('retiming a keyframe to its own current frame leaves it in place', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2), kf(10, 3)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 5);
    expect(out[0].keyframes).toHaveLength(3);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 5, 10]);
    expect(out[0].keyframes.find(k => k.frame === 5)!.value).toBe(2);
  });

  it('retiming to a fractional target that rounds to its own current frame leaves it in place', () => {
    const existing = [track('x', [kf(0, 1), kf(5, 2), kf(10, 3)], 'c1')];
    const out = retimeKeyframe(existing, 'c1', 'x', 5, 5.4);
    expect(out[0].keyframes).toHaveLength(3);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 5, 10]);
    expect(out[0].keyframes.find(k => k.frame === 5)!.value).toBe(2);
  });

  it('does not mutate the input', () => {
    const originalKeyframes = [kf(0, 1), kf(5, 2)];
    const originalTrack = track('x', originalKeyframes, 'c1');
    const input = [originalTrack];
    retimeKeyframe(input, 'c1', 'x', 5, 8);

    expect(input[0]).toBe(originalTrack);
    expect(originalTrack.keyframes).toBe(originalKeyframes);
    expect(originalKeyframes.map(k => k.frame)).toEqual([0, 5]);
  });
});

describe('insertKeyframe + sampleTrack integration', () => {
  it('samples correctly after keyframes are inserted out of frame order', () => {
    let tracks = insertKeyframe([], 'c1', 'x', kf(10, 1));
    tracks = insertKeyframe(tracks, 'c1', 'x', kf(0, 0));
    tracks = insertKeyframe(tracks, 'c1', 'x', kf(5, 2));

    const t = findTrack(tracks, 'c1', 'x')!;
    expect(sampleTrack(t, 2.5)).toBe(1);
  });

  it('sampling after a replace-insert at the same frame reflects the replacement value', () => {
    let tracks = insertKeyframe([], 'c1', 'x', kf(5, 10));
    tracks = insertKeyframe(tracks, 'c1', 'x', kf(5, 20));

    const t = findTrack(tracks, 'c1', 'x')!;
    expect(t.keyframes).toHaveLength(1);
    expect(sampleTrack(t, 5)).toBe(20);
  });
});

describe('pruneTracksForComponent', () => {
  it('removes all tracks for the given component, leaving others', () => {
    const existing = [
      track('x', [kf(0, 1)], 'c1'),
      track('y', [kf(0, 2)], 'c1'),
      track('x', [kf(0, 3)], 'c2'),
    ];
    const out = pruneTracksForComponent(existing, 'c1');
    expect(out).toHaveLength(1);
    expect(out[0].componentId).toBe('c2');
  });

  it('is a no-op when the component has no tracks', () => {
    const existing = [track('x', [kf(0, 1)], 'c1')];
    const out = pruneTracksForComponent(existing, 'c2');
    expect(out).toEqual(existing);
  });

  it('does not mutate the input array', () => {
    const t1 = track('x', [kf(0, 1)], 'c1');
    const t2 = track('x', [kf(0, 2)], 'c2');
    const input = [t1, t2];
    const out = pruneTracksForComponent(input, 'c1');

    expect(input).toHaveLength(2);
    expect(input[0]).toBe(t1);
    expect(input[1]).toBe(t2);
    expect(out).not.toBe(input);
  });
});

describe('validateTracks', () => {
  const ids = new Set(['c1']);

  it('passes a valid track through unchanged', () => {
    const tracks: AnimationTrack[] = [track('opacity', [kf(0, 0), kf(30, 1)])];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out).toEqual(tracks);
    expect(problems).toEqual([]);
  });

  it('treats a non-array tracks input as no tracks', () => {
    expect(validateTracks(undefined, ids).tracks).toEqual([]);
    expect(validateTracks('not-an-array', ids).tracks).toEqual([]);
  });

  it('drops a malformed track entry', () => {
    const { tracks: out, problems } = validateTracks([null, 'not-a-track', 42], ids);
    expect(out).toEqual([]);
    expect(problems).toEqual([
      { type: 'malformed-track' },
      { type: 'malformed-track' },
      { type: 'malformed-track' },
    ]);
  });

  it('drops a track referencing a component not in the provided set', () => {
    const tracks = [{ componentId: 'ghost', property: 'opacity', keyframes: [kf(0, 0)] }];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out).toEqual([]);
    expect(problems).toEqual([{ type: 'missing-component', componentId: 'ghost', property: 'opacity' }]);
  });

  it('drops a track with no keyframes array', () => {
    const tracks = [{ componentId: 'c1', property: 'opacity', keyframes: 'nope' }];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out).toEqual([]);
    expect(problems).toEqual([{ type: 'no-keyframes-array', componentId: 'c1', property: 'opacity' }]);
  });

  it('sorts unsorted keyframes ascending', () => {
    const tracks: AnimationTrack[] = [track('opacity', [kf(30, 1), kf(0, 0)])];
    const { tracks: out } = validateTracks(tracks, ids);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 30]);
  });

  it('drops a keyframe with a non-finite frame or value', () => {
    const tracks: AnimationTrack[] = [
      track('opacity', [
        { frame: Number.NaN, value: 0, interpolation: 'linear' },
        { frame: 0, value: Number.POSITIVE_INFINITY, interpolation: 'linear' },
        kf(10, 1),
      ]),
    ];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out[0].keyframes).toHaveLength(1);
    expect(out[0].keyframes[0].frame).toBe(10);
    expect(problems).toEqual([
      { type: 'invalid-keyframe', componentId: 'c1', property: 'opacity' },
      { type: 'invalid-keyframe', componentId: 'c1', property: 'opacity' },
    ]);
  });

  it('drops the later duplicate when two keyframes share a frame, keeping the first', () => {
    const tracks: AnimationTrack[] = [
      track('opacity', [
        { frame: 0, value: 0.5, interpolation: 'linear' },
        { frame: 0, value: 0.9, interpolation: 'linear' },
      ]),
    ];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out[0].keyframes).toEqual([{ frame: 0, value: 0.5, interpolation: 'linear' }]);
    expect(problems).toEqual([{ type: 'duplicate-keyframe', componentId: 'c1', property: 'opacity', frame: 0 }]);
  });

  it('drops a track left with no keyframes after cleanup', () => {
    const tracks: AnimationTrack[] = [
      track('opacity', [{ frame: Number.NaN, value: 0, interpolation: 'linear' }]),
    ];
    const { tracks: out, problems } = validateTracks(tracks, ids);
    expect(out).toEqual([]);
    expect(problems).toEqual(
      expect.arrayContaining([{ type: 'empty-track', componentId: 'c1', property: 'opacity' }]),
    );
  });

  it('keeps a string value track (color) intact', () => {
    const tracks: AnimationTrack[] = [track('color', [kf(0, '#ffffff'), kf(10, '#000000')])];
    const { tracks: out } = validateTracks(tracks, ids);
    expect(out).toEqual(tracks);
  });
});

describe('keyframe copy/paste semantics', () => {
  const bezier: Keyframe = {
    frame: 10,
    value: 42,
    interpolation: 'bezier',
    handleIn: { dFrame: -3, dValue: -8 },
    handleOut: { dFrame: 4, dValue: 6 },
    handleMode: 'aligned',
  };

  it('carries interpolation and both handles to the pasted frame', () => {
    const tracks = insertKeyframe([], 'c1', 'x', bezier);
    const pasted = insertKeyframe(tracks, 'c1', 'x', { ...bezier, frame: 25 });
    const copy = findTrack(pasted, 'c1', 'x')!.keyframes.find(k => k.frame === 25)!;

    expect(copy.value).toBe(42);
    expect(copy.interpolation).toBe('bezier');
    expect(copy.handleIn).toEqual({ dFrame: -3, dValue: -8 });
    expect(copy.handleOut).toEqual({ dFrame: 4, dValue: 6 });
    expect(copy.handleMode).toBe('aligned');
  });

  it('leaves the source keyframe untouched when pasting elsewhere', () => {
    const tracks = insertKeyframe([], 'c1', 'x', bezier);
    const pasted = insertKeyframe(tracks, 'c1', 'x', { ...bezier, frame: 25 });
    const keyframes = findTrack(pasted, 'c1', 'x')!.keyframes;

    expect(keyframes.map(k => k.frame)).toEqual([10, 25]);
    expect(keyframes[0]).toEqual(bezier);
  });

  it('replaces the target keyframe when pasting onto an occupied frame', () => {
    let tracks = insertKeyframe([], 'c1', 'x', { frame: 30, value: 1, interpolation: 'linear' });
    tracks = insertKeyframe(tracks, 'c1', 'x', { ...bezier, frame: 30 });
    const keyframes = findTrack(tracks, 'c1', 'x')!.keyframes;

    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].value).toBe(42);
    expect(keyframes[0].interpolation).toBe('bezier');
  });

  it('pastes a string-valued colour keyframe without coercing it', () => {
    const colorKey: Keyframe = { frame: 0, value: '#ff0000', interpolation: 'linear' };
    const tracks = insertKeyframe([], 'c1', 'color', colorKey);
    const pasted = insertKeyframe(tracks, 'c1', 'color', { ...colorKey, frame: 12 });
    const copy = findTrack(pasted, 'c1', 'color')!.keyframes.find(k => k.frame === 12)!;

    expect(copy.value).toBe('#ff0000');
  });
});

describe('handle mode maths', () => {
  it('mirrors a handle through the keyframe', () => {
    expect(mirrorHandle({ dFrame: 4, dValue: -6 })).toEqual({ dFrame: -4, dValue: 6 });
  });

  it('vector mode makes the counterpart an exact mirror', () => {
    const out = counterpartHandle('vector', { dFrame: 3, dValue: 9 }, { dFrame: -1, dValue: -1 });
    expect(out).toEqual({ dFrame: -3, dValue: -9 });
  });

  it('aligned mode flips direction but keeps the other handle length', () => {
    const other = { dFrame: -5, dValue: 0 };
    const out = counterpartHandle('aligned', { dFrame: 3, dValue: 4 }, other)!;
    expect(Math.hypot(out.dFrame, out.dValue)).toBeCloseTo(5, 6);
    expect(out.dFrame).toBeCloseTo(-3, 6);
    expect(out.dValue).toBeCloseTo(-4, 6);
  });

  it('free mode leaves the other handle alone', () => {
    const other = { dFrame: -1, dValue: -2 };
    expect(counterpartHandle('free', { dFrame: 9, dValue: 9 }, other)).toBe(other);
  });

  it('auto mode ignores the drag', () => {
    const other = { dFrame: -1, dValue: -2 };
    expect(counterpartHandle('auto', { dFrame: 9, dValue: 9 }, other)).toBe(other);
  });

  it('aligned mode with a zero-length drag keeps the other handle rather than dividing by zero', () => {
    const other = { dFrame: -2, dValue: -2 };
    expect(counterpartHandle('aligned', { dFrame: 0, dValue: 0 }, other)).toBe(other);
  });
});

describe('autoHandles', () => {
  const at = (frame: number, value: number): Keyframe => ({ frame, value, interpolation: 'bezier' });

  it('follows the slope between neighbours', () => {
    const { handleIn, handleOut } = autoHandles(at(0, 0), at(10, 10), at(20, 20));
    expect(handleOut.dValue / handleOut.dFrame).toBeCloseTo(1, 6);
    expect(handleIn.dValue / handleIn.dFrame).toBeCloseTo(1, 6);
  });

  it('flattens at the first keyframe so the curve does not overshoot', () => {
    const { handleOut } = autoHandles(undefined, at(0, 5), at(10, 100));
    expect(handleOut.dValue).toBe(0);
  });

  it('flattens at the last keyframe', () => {
    const { handleIn } = autoHandles(at(0, 100), at(10, 5), undefined);
    expect(handleIn.dValue).toBe(0);
  });

  it('spans a third of each neighbouring gap', () => {
    const { handleIn, handleOut } = autoHandles(at(0, 0), at(30, 0), at(90, 0));
    expect(handleIn.dFrame).toBeCloseTo(-10, 6);
    expect(handleOut.dFrame).toBeCloseTo(20, 6);
  });
});

describe('keyframe editing helpers', () => {
  const track = (): AnimationTrack[] => [{
    componentId: 'c1',
    property: 'x',
    keyframes: [
      { frame: 0, value: 0, interpolation: 'linear' },
      { frame: 10, value: 50, interpolation: 'linear' },
      { frame: 20, value: 100, interpolation: 'linear' },
    ],
  }];

  it('sets a keyframe value without moving it', () => {
    const out = setKeyframeValue(track(), 'c1', 'x', 10, 75);
    const kf = findTrack(out, 'c1', 'x')!.keyframes[1];
    expect(kf).toMatchObject({ frame: 10, value: 75 });
  });

  it('switching to bezier seeds handles from the neighbours', () => {
    const out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'bezier');
    const kf = findTrack(out, 'c1', 'x')!.keyframes[1];
    expect(kf.interpolation).toBe('bezier');
    expect(kf.handleMode).toBe('aligned');
    expect(kf.handleIn).toBeDefined();
    expect(kf.handleOut).toBeDefined();
  });

  it('switching to constant does not invent handles', () => {
    const out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'constant');
    const kf = findTrack(out, 'c1', 'x')!.keyframes[1];
    expect(kf.interpolation).toBe('constant');
    expect(kf.handleIn).toBeUndefined();
  });

  it('preserves handles the user already set when re-selecting bezier', () => {
    let out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'bezier');
    out = setKeyframeHandle(out, 'c1', 'x', 10, 'out', { dFrame: 6, dValue: 30 });
    out = setKeyframeInterpolation(out, 'c1', 'x', 10, 'bezier');
    expect(findTrack(out, 'c1', 'x')!.keyframes[1].handleOut).toEqual({ dFrame: 6, dValue: 30 });
  });

  it('dragging a handle applies the mode to the opposite side', () => {
    let out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'bezier');
    out = setKeyframeHandleMode(out, 'c1', 'x', 10, 'vector');
    out = setKeyframeHandle(out, 'c1', 'x', 10, 'out', { dFrame: 4, dValue: 8 });
    const kf = findTrack(out, 'c1', 'x')!.keyframes[1];
    expect(kf.handleOut).toEqual({ dFrame: 4, dValue: 8 });
    expect(kf.handleIn).toEqual({ dFrame: -4, dValue: -8 });
  });

  it('refuses to move handles on an auto keyframe', () => {
    let out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'bezier');
    out = setKeyframeHandleMode(out, 'c1', 'x', 10, 'auto');
    const before = findTrack(out, 'c1', 'x')!.keyframes[1];
    out = setKeyframeHandle(out, 'c1', 'x', 10, 'out', { dFrame: 99, dValue: 99 });
    expect(findTrack(out, 'c1', 'x')!.keyframes[1]).toEqual(before);
  });

  it('recomputes handles when switching to auto', () => {
    let out = setKeyframeInterpolation(track(), 'c1', 'x', 10, 'bezier');
    out = setKeyframeHandle(out, 'c1', 'x', 10, 'out', { dFrame: 99, dValue: 99 });
    out = setKeyframeHandleMode(out, 'c1', 'x', 10, 'auto');
    expect(findTrack(out, 'c1', 'x')!.keyframes[1].handleOut!.dFrame).toBeCloseTo(3.333, 2);
  });

  it('leaves tracks untouched when the frame has no keyframe', () => {
    const input = track();
    expect(setKeyframeValue(input, 'c1', 'x', 7, 1)).toBe(input);
    expect(setKeyframeInterpolation(input, 'c1', 'y', 10, 'bezier')).toBe(input);
  });
});

describe('setKeyframeEasing', () => {
  const twoKeys = (): AnimationTrack[] => [{
    componentId: 'c1',
    property: 'x',
    keyframes: [
      { frame: 5, value: 700, interpolation: 'linear' },
      { frame: 58, value: 1347, interpolation: 'linear' },
    ],
  }];

  it('eases the incoming segment when the LAST keyframe is selected', () => {
    const out = setKeyframeEasing(twoKeys(), 'c1', 'x', 58, 'bezier');
    const keys = findTrack(out, 'c1', 'x')!.keyframes;
    expect(keys[0].interpolation).toBe('bezier');
    expect(keys[0].handleOut).toBeDefined();
    expect(keys[1].handleIn).toBeDefined();
  });

  it('eases the outgoing segment when the FIRST keyframe is selected', () => {
    const out = setKeyframeEasing(twoKeys(), 'c1', 'x', 5, 'bezier');
    expect(findTrack(out, 'c1', 'x')!.keyframes[0].interpolation).toBe('bezier');
  });

  it('actually bends the curve, unlike setting one key alone', () => {
    const linear = twoKeys();
    const midFrame = 31;
    const before = sampleTrack(findTrack(linear, 'c1', 'x')!, midFrame);

    const onlyLast = setKeyframeInterpolation(linear, 'c1', 'x', 58, 'bezier');
    expect(sampleTrack(findTrack(onlyLast, 'c1', 'x')!, midFrame)).toBe(before);

    const eased = setKeyframeEasing(linear, 'c1', 'x', 58, 'bezier');
    expect(sampleTrack(findTrack(eased, 'c1', 'x')!, midFrame)).not.toBe(before);
  });

  it('applies constant to the incoming segment too', () => {
    const out = setKeyframeEasing(twoKeys(), 'c1', 'x', 58, 'constant');
    expect(findTrack(out, 'c1', 'x')!.keyframes[0].interpolation).toBe('constant');
  });

  it('leaves tracks alone for a frame with no keyframe', () => {
    const input = twoKeys();
    expect(setKeyframeEasing(input, 'c1', 'x', 12, 'bezier')).toBe(input);
  });
});

describe('autoHandles at track boundaries', () => {
  const at = (frame: number, value: number): Keyframe => ({ frame, value, interpolation: 'bezier' });

  it('gives the first keyframe a usable handleIn instead of a third of a frame', () => {
    const { handleIn } = autoHandles(undefined, at(5, 700), at(58, 1347));
    expect(Math.abs(handleIn.dFrame)).toBeGreaterThan(1);
    expect(Math.abs(handleIn.dFrame)).toBeCloseTo((58 - 5) / 3, 6);
  });

  it('gives the last keyframe a usable handleOut', () => {
    const { handleOut } = autoHandles(at(5, 700), at(58, 1347), undefined);
    expect(handleOut.dFrame).toBeCloseTo((58 - 5) / 3, 6);
  });

  it('still works for a lone keyframe', () => {
    const { handleIn, handleOut } = autoHandles(undefined, at(0, 0), undefined);
    expect(handleIn.dFrame).toBeCloseTo(-1, 6);
    expect(handleOut.dFrame).toBeCloseTo(1, 6);
  });
});

describe('insertKeyframeOnCurve', () => {
  const sampleAcross = (tracks: AnimationTrack[], from: number, to: number) => {
    const track = findTrack(tracks, 'c1', 'x')!;
    const out: number[] = [];
    for (let f = from; f <= to; f++) out.push(sampleTrack(track, f) as number);
    return out;
  };

  const linearTrack = (): AnimationTrack[] => [{
    componentId: 'c1',
    property: 'x',
    keyframes: [
      { frame: 0, value: 0, interpolation: 'linear' },
      { frame: 60, value: 600, interpolation: 'linear' },
    ],
  }];

  const bezierTrack = (): AnimationTrack[] => [{
    componentId: 'c1',
    property: 'x',
    keyframes: [
      {
        frame: 0, value: 0, interpolation: 'bezier', handleMode: 'aligned',
        handleOut: { dFrame: 20, dValue: 0 },
      },
      {
        frame: 60, value: 600, interpolation: 'bezier', handleMode: 'aligned',
        handleIn: { dFrame: -20, dValue: 0 },
      },
    ],
  }];

  it('takes its value from the curve, not from nowhere', () => {
    const out = insertKeyframeOnCurve(linearTrack(), 'c1', 'x', 30);
    const inserted = findTrack(out, 'c1', 'x')!.keyframes.find(k => k.frame === 30)!;
    expect(inserted.value).toBeCloseTo(300, 6);
  });

  it('leaves a LINEAR curve numerically unchanged', () => {
    const before = sampleAcross(linearTrack(), 0, 60);
    const after = sampleAcross(insertKeyframeOnCurve(linearTrack(), 'c1', 'x', 37), 0, 60);
    after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 6));
  });

  it('leaves a BEZIER curve numerically unchanged (exact split)', () => {
    const before = sampleAcross(bezierTrack(), 0, 60);
    const out = insertKeyframeOnCurve(bezierTrack(), 'c1', 'x', 25);
    const after = sampleAcross(out, 0, 60);
    after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 4));
  });

  it('leaves a CONSTANT curve unchanged and keeps the step', () => {
    const stepped: AnimationTrack[] = [{
      componentId: 'c1',
      property: 'x',
      keyframes: [
        { frame: 0, value: 10, interpolation: 'constant' },
        { frame: 60, value: 99, interpolation: 'constant' },
      ],
    }];
    const before = sampleAcross(stepped, 0, 60);
    const out = insertKeyframeOnCurve(stepped, 'c1', 'x', 30);
    expect(findTrack(out, 'c1', 'x')!.keyframes.find(k => k.frame === 30)!.value).toBe(10);
    sampleAcross(out, 0, 60).forEach((v, i) => expect(v).toBe(before[i]));
  });

  it('splits the surrounding handles rather than leaving them stale', () => {
    const out = insertKeyframeOnCurve(bezierTrack(), 'c1', 'x', 30);
    const keys = findTrack(out, 'c1', 'x')!.keyframes;
    expect(keys[0].handleOut!.dFrame).toBeLessThan(20);
    expect(keys[2].handleIn!.dFrame).toBeGreaterThan(-20);
    expect(keys[1].handleIn).toBeDefined();
    expect(keys[1].handleOut).toBeDefined();
    expect(keys[1].handleMode).toBe('free');
  });

  it('refuses to duplicate an existing keyframe', () => {
    const input = linearTrack();
    expect(insertKeyframeOnCurve(input, 'c1', 'x', 60)).toBe(input);
    expect(insertKeyframeOnCurve(input, 'c1', 'x', 0)).toBe(input);
  });

  it('holds the end value when inserting outside the authored range', () => {
    const out = insertKeyframeOnCurve(linearTrack(), 'c1', 'x', 80);
    expect(findTrack(out, 'c1', 'x')!.keyframes.find(k => k.frame === 80)!.value).toBe(600);
  });

  it('rounds to whole frames like every other keyframe edit', () => {
    const out = insertKeyframeOnCurve(linearTrack(), 'c1', 'x', 30.4);
    expect(findTrack(out, 'c1', 'x')!.keyframes.some(k => k.frame === 30)).toBe(true);
  });

  it('ignores empty, missing and non-numeric tracks', () => {
    expect(insertKeyframeOnCurve([], 'c1', 'x', 10)).toEqual([]);
    const colour: AnimationTrack[] = [{
      componentId: 'c1', property: 'color',
      keyframes: [
        { frame: 0, value: '#000000', interpolation: 'linear' },
        { frame: 10, value: '#ffffff', interpolation: 'linear' },
      ],
    }];
    expect(insertKeyframeOnCurve(colour, 'c1', 'color', 5)).toBe(colour);
  });
});
