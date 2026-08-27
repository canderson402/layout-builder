import { sampleTrack, type AnimationTrack, type Handle, type Keyframe } from '../shared/utils/overlayTimeline';
import { ease } from '../shared/utils/easing';

export interface ValueRange {
  min: number;
  max: number;
}

export const FALLBACK_RANGE: ValueRange = { min: 0, max: 1 };

const MIN_SPAN = 1e-6;

function numericValue(keyframe: Keyframe): number | null {
  return typeof keyframe.value === 'number' && Number.isFinite(keyframe.value)
    ? keyframe.value
    : null;
}

const EASED_SAMPLES = 24;

function easedSegmentValues(left: Keyframe, right: Keyframe, samples: number): number[] {
  const from = numericValue(left);
  const to = numericValue(right);
  if (from === null || to === null) return [];

  const out: number[] = [];
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    out.push(from + (to - from) * ease(left.easing, t));
  }
  return out;
}

export function computeValueRange(tracks: AnimationTrack[], padRatio = 0.1): ValueRange {
  let min = Infinity;
  let max = -Infinity;

  for (const track of tracks) {
    for (const keyframe of track.keyframes) {
      const value = numericValue(keyframe);
      if (value === null) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);

      for (const handle of [keyframe.handleIn, keyframe.handleOut]) {
        if (!handle || !Number.isFinite(handle.dValue)) continue;
        min = Math.min(min, value + handle.dValue);
        max = Math.max(max, value + handle.dValue);
      }
    }

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      const left = track.keyframes[i];
      if (left.interpolation !== 'eased' || !left.easing) continue;
      for (const value of easedSegmentValues(left, track.keyframes[i + 1], EASED_SAMPLES)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return FALLBACK_RANGE;

  if (max - min < MIN_SPAN) {
    const pad = Math.max(Math.abs(max) * padRatio, 1);
    return { min: min - pad, max: max + pad };
  }

  const pad = (max - min) * padRatio;
  return { min: min - pad, max: max + pad };
}

const MIN_ZOOM_SPAN = 1e-4;
const MAX_ZOOM_SPAN = 1e9;

export function zoomRange(range: ValueRange, focusValue: number, factor: number): ValueRange {
  const span = range.max - range.min;
  if (!(span > 0) || !Number.isFinite(factor) || factor <= 0) return range;

  const nextSpan = Math.min(MAX_ZOOM_SPAN, Math.max(MIN_ZOOM_SPAN, span * factor));
  const ratio = span === 0 ? 0.5 : (focusValue - range.min) / span;
  const min = focusValue - nextSpan * ratio;
  return { min, max: min + nextSpan };
}

export function panRange(range: ValueRange, deltaValue: number): ValueRange {
  if (!Number.isFinite(deltaValue)) return range;
  return { min: range.min + deltaValue, max: range.max + deltaValue };
}

export function valuePerPixel(range: ValueRange, height: number): number {
  if (height <= 0) return 0;
  return (range.max - range.min) / height;
}

export function valueToY(value: number, range: ValueRange, height: number): number {
  const span = range.max - range.min;
  if (span <= 0) return height / 2;
  return height - ((value - range.min) / span) * height;
}

export function yToValue(y: number, range: ValueRange, height: number): number {
  if (height <= 0) return range.min;
  const span = range.max - range.min;
  return range.min + ((height - y) / height) * span;
}

export interface HandlePoint {
  x: number;
  y: number;
}

export function handlePoint(
  keyframe: Keyframe,
  handle: Handle | undefined,
  range: ValueRange,
  height: number,
  pixelsPerFrame: number,
  originFrame: number,
): HandlePoint | null {
  const value = numericValue(keyframe);
  if (value === null || !handle) return null;
  if (!Number.isFinite(handle.dFrame) || !Number.isFinite(handle.dValue)) return null;
  return {
    x: (keyframe.frame + handle.dFrame - originFrame) * pixelsPerFrame,
    y: valueToY(value + handle.dValue, range, height),
  };
}

export function handleFromPoint(
  keyframe: Keyframe,
  point: HandlePoint,
  range: ValueRange,
  height: number,
  pixelsPerFrame: number,
  originFrame: number,
): Handle | null {
  const value = numericValue(keyframe);
  if (value === null || pixelsPerFrame <= 0) return null;
  return {
    dFrame: point.x / pixelsPerFrame + originFrame - keyframe.frame,
    dValue: yToValue(point.y, range, height) - value,
  };
}

export interface CurveHit {
  track: AnimationTrack;
  frame: number;
  value: number;
  x: number;
  y: number;
  distance: number;
}

export interface CurveHitOptions {
  range: ValueRange;
  height: number;
  pixelsPerFrame: number;
  originFrame: number;
  searchPx?: number;
  stepPx?: number;
}

export function nearestCurvePoint(
  tracks: AnimationTrack[],
  pointerX: number,
  pointerY: number,
  options: CurveHitOptions,
): CurveHit | null {
  const { range, height, pixelsPerFrame, originFrame, searchPx = 40, stepPx = 2 } = options;
  if (pixelsPerFrame <= 0) return null;

  let best: CurveHit | null = null;

  for (const track of tracks) {
    if (track.keyframes.length === 0) continue;

    for (let dx = -searchPx; dx <= searchPx; dx += stepPx) {
      const x = pointerX + dx;
      const frame = x / pixelsPerFrame + originFrame;
      const value = sampleTrack(track, frame);
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      const y = valueToY(value, range, height);
      const distance = Math.hypot(x - pointerX, y - pointerY);
      if (!best || distance < best.distance) {
        best = { track, frame, value, x, y, distance };
      }
    }
  }

  return best;
}

export function buildCurvePath(
  keyframes: Keyframe[],
  range: ValueRange,
  height: number,
  pixelsPerFrame: number,
  originFrame: number,
): string {
  const points = keyframes
    .map(k => ({ keyframe: k, value: numericValue(k) }))
    .filter((p): p is { keyframe: Keyframe; value: number } => p.value !== null);

  if (points.length === 0) return '';

  const px = (frame: number) => (frame - originFrame) * pixelsPerFrame;
  const py = (value: number) => valueToY(value, range, height);

  let path = `M ${px(points[0].keyframe.frame)} ${py(points[0].value)}`;

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    const x1 = px(right.keyframe.frame);
    const y1 = py(right.value);

    if (left.keyframe.interpolation === 'constant') {
      path += ` L ${x1} ${py(left.value)} L ${x1} ${y1}`;
      continue;
    }

    if (left.keyframe.interpolation === 'bezier') {
      const out = left.keyframe.handleOut;
      const inn = right.keyframe.handleIn;
      const c1x = px(left.keyframe.frame + (out?.dFrame ?? 0));
      const c1y = py(left.value + (out?.dValue ?? 0));
      const c2x = px(right.keyframe.frame + (inn?.dFrame ?? 0));
      const c2y = py(right.value + (inn?.dValue ?? 0));
      path += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${x1} ${y1}`;
      continue;
    }

    if (left.keyframe.interpolation === 'eased' && left.keyframe.easing) {
      const pixelWidth = Math.abs(x1 - px(left.keyframe.frame));
      const samples = Math.max(8, Math.min(96, Math.round(pixelWidth / 4)));
      const spanFrames = right.keyframe.frame - left.keyframe.frame;
      for (let s = 1; s < samples; s++) {
        const t = s / samples;
        const frame = left.keyframe.frame + spanFrames * t;
        const value = left.value + (right.value - left.value) * ease(left.keyframe.easing, t);
        path += ` L ${px(frame)} ${py(value)}`;
      }
      path += ` L ${x1} ${y1}`;
      continue;
    }

    path += ` L ${x1} ${y1}`;
  }

  return path;
}
