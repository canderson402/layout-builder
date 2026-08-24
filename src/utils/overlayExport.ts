import { ComponentConfig } from '../types';
import { OverlayConfig, AnimationTrack, TrackValidationProblem, validateTracks } from '../shared/utils/overlayTimeline';
import { expandLayoutForRuntime } from './slotTemplates';
import { bakeShapeComponents } from './shapeExport';
import { sanitizeTransforms } from './transformExport';
import { cleanComponentProps, normalizeLayerValues } from '../components/ExportModal';

function formatTrackProblem(problem: TrackValidationProblem): string {
  switch (problem.type) {
    case 'malformed-track':
      return 'Export: dropping malformed track';
    case 'missing-component':
      return `Export: dropping track for missing component "${problem.componentId}.${problem.property}"`;
    case 'no-keyframes-array':
      return `Export: dropping track with no keyframes array "${problem.componentId}.${problem.property}"`;
    case 'invalid-keyframe':
      return `Export: dropping invalid keyframe on "${problem.componentId}.${problem.property}"`;
    case 'duplicate-keyframe':
      return `Export: dropping duplicate keyframe at frame ${problem.frame} on "${problem.componentId}.${problem.property}"`;
    case 'empty-track':
      return `Export: dropping empty track "${problem.componentId}.${problem.property}"`;
  }
}

export function validateOverlayTracks(
  tracks: AnimationTrack[],
  components: ComponentConfig[],
): AnimationTrack[] {
  const componentIds = new Set(components.map(c => c.id));
  const { tracks: out, problems } = validateTracks(tracks, componentIds);
  for (const problem of problems) {
    console.warn(formatTrackProblem(problem));
  }
  return out;
}

export function cleanOverlayForExport(overlay: OverlayConfig): OverlayConfig {
  const inlinedComponents = expandLayoutForRuntime(overlay.components as ComponentConfig[]);
  const normalizedComponents = normalizeLayerValues(inlinedComponents);
  const components = sanitizeTransforms(bakeShapeComponents(normalizedComponents)).map(cleanComponentProps);

  return {
    ...overlay,
    components,
    tracks: validateOverlayTracks(overlay.tracks, components),
  };
}
