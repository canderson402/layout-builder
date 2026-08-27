import { ease, type Easing } from './easing';

export type AnimatableProperty =
  | 'x' | 'y' | 'width' | 'height' | 'scale' | 'rotation' | 'opacity' | 'color' | 'backgroundColor';

export type { Easing, EasingDirection, EasingFunction } from './easing';

export type Interpolation = 'linear' | 'bezier' | 'constant' | 'eased';
export type HandleMode = 'free' | 'aligned' | 'vector' | 'auto';

export interface Handle {
  dFrame: number;
  dValue: number;
}

export interface Keyframe {
  frame: number;
  value: number | string;
  interpolation: Interpolation;
  handleIn?: Handle;
  handleOut?: Handle;
  handleMode?: HandleMode;
  easing?: Easing;
}

export interface AnimationTrack {
  componentId: string;
  property: AnimatableProperty;
  keyframes: Keyframe[];
}

export interface OverlayConfig {
  id: string;
  name: string;
  components: unknown[];
  dimensions: { width: number; height: number };
  backgroundColor?: string;
  fps: number;
  startFrame: number;
  endFrame: number;
  isTransition?: boolean;
  switchFrame?: number;
  tracks: AnimationTrack[];
}

export interface SampledValues {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  color?: string;
  backgroundColor?: string;
}

export function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.frame - b.frame);
}

function findSegment(keyframes: Keyframe[], frame: number): number {
  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (keyframes[mid].frame <= frame) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

const BEZIER_EPSILON = 1e-7;
const BEZIER_MAX_NEWTON = 8;
const BEZIER_MAX_BISECT = 40;

function finite(n: number | undefined, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function cubic(a: number, b: number, c: number, d: number, u: number): number {
  const mu = 1 - u;
  return mu * mu * mu * a + 3 * mu * mu * u * b + 3 * mu * u * u * c + u * u * u * d;
}

function cubicSlope(a: number, b: number, c: number, d: number, u: number): number {
  const mu = 1 - u;
  return 3 * mu * mu * (b - a) + 6 * mu * u * (c - b) + 3 * u * u * (d - c);
}

function solveParameterForX(x0: number, x1: number, x2: number, x3: number, x: number): number {
  let u = x3 === x0 ? 0 : (x - x0) / (x3 - x0);
  u = Math.min(1, Math.max(0, u));

  for (let i = 0; i < BEZIER_MAX_NEWTON; i++) {
    const err = cubic(x0, x1, x2, x3, u) - x;
    if (Math.abs(err) < BEZIER_EPSILON) return u;
    const slope = cubicSlope(x0, x1, x2, x3, u);
    if (Math.abs(slope) < BEZIER_EPSILON) break;
    const next = u - err / slope;
    if (!Number.isFinite(next)) break;
    u = Math.min(1, Math.max(0, next));
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BEZIER_MAX_BISECT; i++) {
    u = (lo + hi) / 2;
    const err = cubic(x0, x1, x2, x3, u) - x;
    if (Math.abs(err) < BEZIER_EPSILON) return u;
    if (err > 0) hi = u; else lo = u;
  }
  return u;
}

function bezierValue(left: Keyframe, right: Keyframe, frame: number): number {
  const f0 = left.frame;
  const f3 = right.frame;
  const v0 = left.value as number;
  const v3 = right.value as number;

  const outF = finite(left.handleOut?.dFrame, 0);
  const outV = finite(left.handleOut?.dValue, 0);
  const inF = finite(right.handleIn?.dFrame, 0);
  const inV = finite(right.handleIn?.dValue, 0);

  const f1 = Math.min(f3, Math.max(f0, f0 + outF));
  const f2 = Math.min(f3, Math.max(f0, f3 + inF));
  const v1 = v0 + outV;
  const v2 = v3 + inV;

  if (f1 === f0 && v1 === v0 && f2 === f3 && v2 === v3) {
    return v0 + (v3 - v0) * ((frame - f0) / (f3 - f0));
  }

  const u = solveParameterForX(f0, f1, f2, f3, frame);
  return cubic(v0, v1, v2, v3, u);
}

function parseHex(input: string): { r: number; g: number; b: number } | null {
  if (typeof input !== 'string') return null;
  let hex = input.trim().toLowerCase();
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6 || !/^[0-9a-f]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex(n: number): string {
  const v = Math.min(255, Math.max(0, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

export function mixHexColors(a: string, b: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca && !cb) return clamped < 0.5 ? a : b;
  if (!ca) return b;
  if (!cb) return a;
  return `#${toHex(ca.r + (cb.r - ca.r) * clamped)}${toHex(ca.g + (cb.g - ca.g) * clamped)}${toHex(ca.b + (cb.b - ca.b) * clamped)}`;
}

export function sampleTrack(track: AnimationTrack, frame: number): number | string | undefined {
  if (!Number.isFinite(frame)) frame = 0;
  const keys = track.keyframes;
  if (!keys || keys.length === 0) return undefined;
  if (keys.length === 1) return keys[0].value;

  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) return first.value;
  if (frame >= last.frame) return last.value;

  const i = findSegment(keys, frame);
  const left = keys[i];
  const right = keys[i + 1];
  if (!right) return left.value;

  const span = right.frame - left.frame;
  if (span <= 0) return right.value;
  if (left.interpolation === 'constant') return left.value;

  const progress = (frame - left.frame) / span;
  const t = left.interpolation === 'eased' && left.easing
    ? ease(left.easing, progress)
    : progress;

  if (typeof left.value === 'number' && typeof right.value === 'number') {
    if (left.interpolation === 'bezier') {
      return bezierValue(left, right, frame);
    }
    return left.value + (right.value - left.value) * t;
  }

  if (typeof left.value === 'string' && typeof right.value === 'string') {
    return mixHexColors(left.value, right.value, t);
  }

  return left.value;
}

export function findTrack(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
): AnimationTrack | undefined {
  return tracks.find(t => t.componentId === componentId && t.property === property);
}

function replaceTrackKeyframes(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  keyframes: Keyframe[],
): AnimationTrack[] {
  const idx = tracks.findIndex(t => t.componentId === componentId && t.property === property);
  const next = [...tracks];
  if (idx === -1) {
    next.push({ componentId, property, keyframes });
  } else {
    next[idx] = { ...tracks[idx], keyframes };
  }
  return next;
}

export function insertKeyframe(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  keyframe: Keyframe,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  const withoutSameFrame = (existing?.keyframes ?? []).filter(k => k.frame !== keyframe.frame);
  const keyframes = sortKeyframes([...withoutSameFrame, keyframe]);
  return replaceTrackKeyframes(tracks, componentId, property, keyframes);
}

export function removeKeyframe(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  if (!existing) return tracks;
  if (!existing.keyframes.some(k => k.frame === frame)) return tracks;

  const remaining = existing.keyframes.filter(k => k.frame !== frame);
  if (remaining.length === 0) {
    return tracks.filter(t => !(t.componentId === componentId && t.property === property));
  }
  return replaceTrackKeyframes(tracks, componentId, property, sortKeyframes(remaining));
}

export function mirrorHandle(handle: Handle): Handle {
  return { dFrame: -handle.dFrame, dValue: -handle.dValue };
}

function handleLength(handle: Handle): number {
  return Math.hypot(handle.dFrame, handle.dValue);
}

export function counterpartHandle(
  mode: HandleMode | undefined,
  dragged: Handle,
  other: Handle | undefined,
): Handle | undefined {
  if (mode === 'vector') return mirrorHandle(dragged);

  if (mode === 'aligned') {
    const mirrored = mirrorHandle(dragged);
    const draggedLength = handleLength(dragged);
    if (draggedLength === 0) return other;
    const keepLength = other ? handleLength(other) : draggedLength;
    const unitF = mirrored.dFrame / draggedLength;
    const unitV = mirrored.dValue / draggedLength;
    return { dFrame: unitF * keepLength, dValue: unitV * keepLength };
  }

  return other;
}

export function autoHandles(
  previous: Keyframe | undefined,
  keyframe: Keyframe,
  next: Keyframe | undefined,
): { handleIn: Handle; handleOut: Handle } {
  const value = typeof keyframe.value === 'number' ? keyframe.value : 0;
  const prevFrame = previous ? previous.frame : keyframe.frame;
  const nextFrame = next ? next.frame : keyframe.frame;
  const prevValue = previous && typeof previous.value === 'number' ? previous.value : value;
  const nextValue = next && typeof next.value === 'number' ? next.value : value;

  const inGap = previous ? keyframe.frame - prevFrame : 0;
  const outGap = next ? nextFrame - keyframe.frame : 0;
  const fallbackGap = Math.max(inGap, outGap, 3);
  const inSpan = (inGap > 0 ? inGap : fallbackGap) / 3;
  const outSpan = (outGap > 0 ? outGap : fallbackGap) / 3;

  const slope = (!previous || !next) || nextFrame === prevFrame
    ? 0
    : (nextValue - prevValue) / (nextFrame - prevFrame);

  const noNegativeZero = (n: number): number => (n === 0 ? 0 : n);

  return {
    handleIn: { dFrame: -inSpan, dValue: noNegativeZero(-slope * inSpan) },
    handleOut: { dFrame: outSpan, dValue: noNegativeZero(slope * outSpan) },
  };
}

function mapKeyframeAt(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  update: (keyframe: Keyframe, index: number, keyframes: Keyframe[]) => Keyframe,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  if (!existing) return tracks;
  const index = existing.keyframes.findIndex(k => k.frame === frame);
  if (index === -1) return tracks;

  const keyframes = existing.keyframes.map((k, i) =>
    i === index ? update(k, i, existing.keyframes) : k,
  );
  return replaceTrackKeyframes(tracks, componentId, property, keyframes);
}

export function setKeyframeValue(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  value: number | string,
): AnimationTrack[] {
  return mapKeyframeAt(tracks, componentId, property, frame, k => ({ ...k, value }));
}

export function setKeyframeInterpolation(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  interpolation: Interpolation,
): AnimationTrack[] {
  return mapKeyframeAt(tracks, componentId, property, frame, (k, i, all) => {
    if (interpolation !== 'bezier') {
      return { ...k, interpolation };
    }
    const derived = autoHandles(all[i - 1], k, all[i + 1]);
    return {
      ...k,
      interpolation,
      handleMode: k.handleMode ?? 'aligned',
      handleIn: k.handleIn ?? derived.handleIn,
      handleOut: k.handleOut ?? derived.handleOut,
    };
  });
}

interface ControlPoints {
  f0: number; v0: number;
  f1: number; v1: number;
  f2: number; v2: number;
  f3: number; v3: number;
}

function segmentControlPoints(left: Keyframe, right: Keyframe): ControlPoints {
  const f0 = left.frame;
  const f3 = right.frame;
  const v0 = left.value as number;
  const v3 = right.value as number;
  return {
    f0, v0,
    f1: Math.min(f3, Math.max(f0, f0 + finite(left.handleOut?.dFrame, 0))),
    v1: v0 + finite(left.handleOut?.dValue, 0),
    f2: Math.min(f3, Math.max(f0, f3 + finite(right.handleIn?.dFrame, 0))),
    v2: v3 + finite(right.handleIn?.dValue, 0),
    f3, v3,
  };
}

function splitCubic(cp: ControlPoints, u: number) {
  const lerp = (a: number, b: number) => a + (b - a) * u;

  const af = lerp(cp.f0, cp.f1), av = lerp(cp.v0, cp.v1);
  const bf = lerp(cp.f1, cp.f2), bv = lerp(cp.v1, cp.v2);
  const cf = lerp(cp.f2, cp.f3), cv = lerp(cp.v2, cp.v3);

  const df = lerp(af, bf), dv = lerp(av, bv);
  const ef = lerp(bf, cf), ev = lerp(bv, cv);

  const sf = lerp(df, ef), sv = lerp(dv, ev);

  return {
    leftOut: { dFrame: af - cp.f0, dValue: av - cp.v0 },
    midIn: { dFrame: df - sf, dValue: dv - sv },
    midFrame: sf,
    midValue: sv,
    midOut: { dFrame: ef - sf, dValue: ev - sv },
    rightIn: { dFrame: cf - cp.f3, dValue: cv - cp.v3 },
  };
}

export function insertKeyframeOnCurve(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  if (!existing || existing.keyframes.length === 0) return tracks;

  const target = Math.round(frame);
  const sorted = sortKeyframes(existing.keyframes);
  if (sorted.some(k => k.frame === target)) return tracks;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (target < first.frame || target > last.frame) {
    const edge = target < first.frame ? first : last;
    if (typeof edge.value !== 'number') return tracks;
    return insertKeyframe(tracks, componentId, property, {
      frame: target,
      value: edge.value,
      interpolation: edge.interpolation,
    });
  }

  let leftIndex = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].frame < target && sorted[i + 1].frame > target) {
      leftIndex = i;
      break;
    }
  }

  const left = sorted[leftIndex];
  const right = sorted[leftIndex + 1];
  if (typeof left.value !== 'number' || typeof right.value !== 'number') return tracks;

  if (left.interpolation === 'constant') {
    return insertKeyframe(tracks, componentId, property, {
      frame: target,
      value: left.value,
      interpolation: 'constant',
    });
  }

  if (left.interpolation === 'eased') {
    const sampled = sampleTrack({ ...existing, keyframes: sorted }, target);
    if (typeof sampled !== 'number') return tracks;
    return insertKeyframe(tracks, componentId, property, {
      frame: target,
      value: sampled,
      interpolation: 'linear',
    });
  }

  if (left.interpolation !== 'bezier') {
    const t = (target - left.frame) / (right.frame - left.frame);
    return insertKeyframe(tracks, componentId, property, {
      frame: target,
      value: left.value + (right.value - left.value) * t,
      interpolation: 'linear',
    });
  }

  const cp = segmentControlPoints(left, right);
  const u = solveParameterForX(cp.f0, cp.f1, cp.f2, cp.f3, target);
  const split = splitCubic(cp, u);

  const keyframes = sorted.map(k => {
    if (k.frame === left.frame) {
      return { ...k, handleOut: split.leftOut };
    }
    if (k.frame === right.frame) {
      return { ...k, handleIn: split.rightIn };
    }
    return k;
  });

  keyframes.push({
    frame: target,
    value: split.midValue,
    interpolation: 'bezier',
    handleMode: 'free',
    handleIn: split.midIn,
    handleOut: split.midOut,
  });

  return replaceTrackKeyframes(tracks, componentId, property, sortKeyframes(keyframes));
}

export function setKeyframeInterpolationMode(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  interpolation: Interpolation,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  if (!existing) return tracks;
  const index = existing.keyframes.findIndex(k => k.frame === frame);
  if (index === -1) return tracks;

  let out = setKeyframeInterpolation(tracks, componentId, property, frame, interpolation);
  const previous = existing.keyframes[index - 1];
  if (previous && previous.interpolation !== 'eased') {
    out = setKeyframeInterpolation(out, componentId, property, previous.frame, interpolation);
  }
  return out;
}

export function setKeyframeEasingSpec(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  easing: Easing | null,
): AnimationTrack[] {
  return mapKeyframeAt(tracks, componentId, property, frame, k => {
    if (easing === null) {
      const { easing: _cleared, ...rest } = k;
      return { ...rest, interpolation: 'linear' };
    }
    return { ...k, interpolation: 'eased', easing };
  });
}

export function setKeyframeHandleMode(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  handleMode: HandleMode,
): AnimationTrack[] {
  return mapKeyframeAt(tracks, componentId, property, frame, (k, i, all) => {
    if (handleMode !== 'auto') return { ...k, handleMode };
    const derived = autoHandles(all[i - 1], k, all[i + 1]);
    return { ...k, handleMode, handleIn: derived.handleIn, handleOut: derived.handleOut };
  });
}

export function setKeyframeHandle(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  frame: number,
  side: 'in' | 'out',
  handle: Handle,
): AnimationTrack[] {
  return mapKeyframeAt(tracks, componentId, property, frame, k => {
    if (k.handleMode === 'auto') return k;
    const other = side === 'in' ? k.handleOut : k.handleIn;
    const counterpart = counterpartHandle(k.handleMode, handle, other);
    return side === 'in'
      ? { ...k, handleIn: handle, handleOut: counterpart }
      : { ...k, handleOut: handle, handleIn: counterpart };
  });
}

export function retimeKeyframe(
  tracks: AnimationTrack[],
  componentId: string,
  property: AnimatableProperty,
  fromFrame: number,
  toFrame: number,
): AnimationTrack[] {
  const existing = findTrack(tracks, componentId, property);
  if (!existing) return tracks;
  const source = existing.keyframes.find(k => k.frame === fromFrame);
  if (!source) return tracks;

  const roundedTo = Math.round(toFrame);
  const remaining = existing.keyframes.filter(k => k.frame !== fromFrame && k.frame !== roundedTo);
  const moved: Keyframe = { ...source, frame: roundedTo };
  const keyframes = sortKeyframes([...remaining, moved]);
  return replaceTrackKeyframes(tracks, componentId, property, keyframes);
}

export function resolveSwitchFrame(overlay: OverlayConfig): number {
  const { startFrame, endFrame } = overlay;

  if (endFrame < startFrame) return startFrame;

  const authored = overlay.switchFrame;
  if (typeof authored === 'number' && Number.isFinite(authored)) {
    return Math.min(endFrame, Math.max(startFrame, Math.round(authored)));
  }

  return Math.round(startFrame + (endFrame - startFrame) / 2);
}

export function setSwitchFrame(overlay: OverlayConfig, frame: number | null): OverlayConfig {
  const next = { ...overlay };

  if (frame === null || !Number.isFinite(frame)) {
    delete next.switchFrame;
    return next;
  }

  const low = Math.min(overlay.startFrame, overlay.endFrame);
  const high = Math.max(overlay.startFrame, overlay.endFrame);
  next.switchFrame = Math.min(high, Math.max(low, Math.round(frame)));
  return next;
}

export function pruneTracksForComponent(
  tracks: AnimationTrack[],
  componentId: string,
): AnimationTrack[] {
  return tracks.filter(t => t.componentId !== componentId);
}

export function remapTracksForComponents(
  tracks: AnimationTrack[],
  idMapping: Map<string, string>,
): AnimationTrack[] {
  const copies: AnimationTrack[] = [];
  for (const track of tracks) {
    const newComponentId = idMapping.get(track.componentId);
    if (!newComponentId) continue;
    copies.push({
      ...track,
      componentId: newComponentId,
      keyframes: track.keyframes.map(k => ({
        ...k,
        ...(k.handleIn ? { handleIn: { ...k.handleIn } } : {}),
        ...(k.handleOut ? { handleOut: { ...k.handleOut } } : {}),
      })),
    });
  }
  return copies;
}

export function copyTracksForComponents(
  tracks: AnimationTrack[],
  idMapping: Map<string, string>,
): AnimationTrack[] {
  const copies = remapTracksForComponents(tracks, idMapping);
  if (copies.length === 0) return tracks;
  return [...tracks, ...copies];
}

export type TrackValidationProblem =
  | { type: 'malformed-track' }
  | { type: 'missing-component'; componentId: string; property: string }
  | { type: 'no-keyframes-array'; componentId: string; property: string }
  | { type: 'invalid-keyframe'; componentId: string; property: string }
  | { type: 'duplicate-keyframe'; componentId: string; property: string; frame: number }
  | { type: 'empty-track'; componentId: string; property: string };

export interface TrackValidationResult {
  tracks: AnimationTrack[];
  problems: TrackValidationProblem[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteKeyframeValue(value: unknown): boolean {
  return typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string';
}

export function validateTracks(tracks: unknown, componentIds: Set<string>): TrackValidationResult {
  const problems: TrackValidationProblem[] = [];

  if (!Array.isArray(tracks)) {
    return { tracks: [], problems };
  }

  const out: AnimationTrack[] = [];

  for (const track of tracks as AnimationTrack[]) {
    if (!isPlainObject(track) || typeof (track as AnimationTrack).componentId !== 'string') {
      problems.push({ type: 'malformed-track' });
      continue;
    }

    const { componentId, property } = track;

    if (!componentIds.has(componentId)) {
      problems.push({ type: 'missing-component', componentId, property });
      continue;
    }

    if (!Array.isArray(track.keyframes)) {
      problems.push({ type: 'no-keyframes-array', componentId, property });
      continue;
    }

    const finiteKeyframes = track.keyframes.filter((k: unknown) => {
      if (!isPlainObject(k) || !Number.isFinite(k.frame as number) || !isFiniteKeyframeValue(k.value)) {
        problems.push({ type: 'invalid-keyframe', componentId, property });
        return false;
      }
      return true;
    }) as Keyframe[];

    const sorted = sortKeyframes(finiteKeyframes);
    const deduped: Keyframe[] = [];
    for (const kf of sorted) {
      const last = deduped[deduped.length - 1];
      if (last && last.frame === kf.frame) {
        problems.push({ type: 'duplicate-keyframe', componentId, property, frame: kf.frame });
        continue;
      }
      deduped.push(kf);
    }

    if (deduped.length === 0) {
      problems.push({ type: 'empty-track', componentId, property });
      continue;
    }

    out.push({ ...track, keyframes: deduped });
  }

  return { tracks: out, problems };
}

export function sampleTracks(tracks: AnimationTrack[], frame: number): Map<string, SampledValues> {
  const out = new Map<string, SampledValues>();
  for (const track of tracks) {
    const sampled = sampleTrack(track, frame);
    if (sampled === undefined) continue;
    let values = out.get(track.componentId);
    if (!values) {
      values = {};
      out.set(track.componentId, values);
    }
    if (track.property === 'color' || track.property === 'backgroundColor') {
      if (typeof sampled === 'string') values[track.property] = sampled;
    } else if (typeof sampled === 'number') {
      values[track.property] = sampled;
    }
  }
  return out;
}
