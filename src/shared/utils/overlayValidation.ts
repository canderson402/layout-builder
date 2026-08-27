import { AnimationTrack, OverlayConfig, TrackValidationProblem, validateTracks } from './overlayTimeline';

export interface OverlayComponentLike {
  id: string;
  parentId?: string;
  [key: string]: unknown;
}

export interface ValidatedOverlay extends OverlayConfig {
  components: OverlayComponentLike[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatTrackProblem(problem: TrackValidationProblem): string {
  switch (problem.type) {
    case 'malformed-track':
      return 'Overlay: dropping malformed track';
    case 'missing-component':
      return `Overlay: dropping track for missing component "${problem.componentId}.${problem.property}"`;
    case 'no-keyframes-array':
      return `Overlay: dropping track with no keyframes array "${problem.componentId}.${problem.property}"`;
    case 'invalid-keyframe':
      return `Overlay: dropping invalid keyframe on "${problem.componentId}.${problem.property}"`;
    case 'duplicate-keyframe':
      return `Overlay: dropping duplicate keyframe at frame ${problem.frame} on "${problem.componentId}.${problem.property}"`;
    case 'empty-track':
      return `Overlay: dropping empty track "${problem.componentId}.${problem.property}"`;
  }
}

export function validateOverlayTracks(
  tracks: unknown,
  componentIds: Set<string>,
): AnimationTrack[] {
  const { tracks: out, problems } = validateTracks(tracks, componentIds);
  for (const problem of problems) {
    console.warn(formatTrackProblem(problem));
  }
  return out;
}

function validateOverlayComponents(raw: unknown, overlayId: string): OverlayComponentLike[] | null {
  if (!Array.isArray(raw)) {
    console.warn(`Overlay "${overlayId}": "components" is not an array, skipping overlay`);
    return null;
  }

  const seen = new Set<string>();
  const out: OverlayComponentLike[] = [];

  for (const c of raw) {
    if (!isPlainObject(c) || typeof c.id !== 'string' || c.id.length === 0) {
      console.warn(`Overlay "${overlayId}": dropping component with missing/invalid "id"`);
      continue;
    }
    if (seen.has(c.id)) {
      console.warn(`Overlay "${overlayId}": dropping component with duplicate id "${c.id}"`);
      continue;
    }
    seen.add(c.id);
    out.push(c as OverlayComponentLike);
  }

  return out;
}

export function validateOverlay(raw: unknown): ValidatedOverlay | null {
  if (!isPlainObject(raw)) {
    console.warn('Overlay: skipping overlay that is not a JSON object');
    return null;
  }

  const { id, name, components, dimensions, fps, startFrame, endFrame, isTransition, switchFrame, tracks, backgroundColor } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    console.warn('Overlay: skipping overlay with missing/invalid "id"');
    return null;
  }

  if (typeof name !== 'string') {
    console.warn(`Overlay "${id}": skipping overlay with missing/invalid "name"`);
    return null;
  }

  if (!isPlainObject(dimensions) || !isFiniteNumber(dimensions.width) || !isFiniteNumber(dimensions.height)) {
    console.warn(`Overlay "${id}": skipping overlay with missing/invalid "dimensions"`);
    return null;
  }

  if (!isFiniteNumber(fps) || fps <= 0) {
    console.warn(`Overlay "${id}": skipping overlay with missing/invalid "fps"`);
    return null;
  }

  if (!isFiniteNumber(startFrame) || !isFiniteNumber(endFrame) || endFrame < startFrame) {
    console.warn(`Overlay "${id}": skipping overlay with missing/invalid start/end frame`);
    return null;
  }

  const validComponents = validateOverlayComponents(components, id);
  if (validComponents === null || validComponents.length === 0) {
    console.warn(`Overlay "${id}": skipping overlay with no valid components`);
    return null;
  }

  const componentIds = new Set(validComponents.map(c => c.id));

  for (const c of validComponents) {
    if (c.parentId !== undefined && (typeof c.parentId !== 'string' || !componentIds.has(c.parentId))) {
      console.warn(`Overlay "${id}": component "${c.id}" has invalid parentId "${String(c.parentId)}", treating as root`);
    }
  }

  if (!Array.isArray(tracks)) {
    console.warn(`Overlay "${id}": "tracks" is missing/invalid, treating overlay as unanimated`);
  }

  const validTracks = validateOverlayTracks(tracks, componentIds);

  return {
    id,
    name,
    components: validComponents,
    dimensions: { width: dimensions.width, height: dimensions.height },
    backgroundColor: typeof backgroundColor === 'string' ? backgroundColor : undefined,
    fps,
    startFrame,
    endFrame,
    ...(isTransition === true ? { isTransition: true } : {}),
    ...(typeof switchFrame === 'number' && Number.isFinite(switchFrame) ? { switchFrame } : {}),
    tracks: validTracks,
  };
}
