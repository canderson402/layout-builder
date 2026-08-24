import type { SampledValues } from './overlayTimeline';
import type { ComponentTransform } from './componentTransform';

export interface PreviewedComponent {
  position: { x: number; y: number };
  size: { width: number; height: number };
  /**
   * Per-axis stretch factor (animated size / authored size). Renderers keep the
   * box at its authored size and apply this, so the TV and the builder deform
   * identically instead of one reflowing and the other scaling.
   */
  stretch: { x: number; y: number };
  transform: ComponentTransform | undefined;
  opacity: number;
  color?: string;
  backgroundColor?: string;
}

export type DirtyChannel = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'scale';

const SCALE_FLOOR = 0.01;

const NO_STRETCH = { x: 1, y: 1 };

function stretchFactor(animated: number, authored: number): number {
  if (!Number.isFinite(authored) || authored === 0) return 1;
  return animated / authored;
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolveChannel(sampled: number | undefined, authored: number): number {
  return sampled !== undefined && Number.isFinite(sampled) ? sampled : authored;
}

export function composePreview(
  position: { x: number; y: number },
  size: { width: number; height: number },
  transform: ComponentTransform | undefined,
  sampled: SampledValues | undefined,
  dirtyChannels?: Set<DirtyChannel>,
): PreviewedComponent {
  if (sampled === undefined) {
    return {
      position,
      size,
      stretch: NO_STRETCH,
      transform,
      opacity: 1,
    };
  }

  const authoredRotation = transform?.rotation ?? 0;
  const authoredScale = transform?.scale ?? 1;

  const x = resolveChannel(dirtyChannels?.has('x') ? undefined : sampled.x, position.x);
  const y = resolveChannel(dirtyChannels?.has('y') ? undefined : sampled.y, position.y);
  const rotation = resolveChannel(dirtyChannels?.has('rotation') ? undefined : sampled.rotation, authoredRotation);
  const scale = resolveChannel(dirtyChannels?.has('scale') ? undefined : sampled.scale, authoredScale);
  const opacity = sampled.opacity !== undefined && Number.isFinite(sampled.opacity) ? sampled.opacity : 1;

  const width = Math.max(
    0,
    resolveChannel(dirtyChannels?.has('width') ? undefined : sampled.width, size.width),
  );
  const height = Math.max(
    0,
    resolveChannel(dirtyChannels?.has('height') ? undefined : sampled.height, size.height),
  );

  const composedPosition = { x, y };
  const composedSize = { width, height };
  const composedStretch = {
    x: stretchFactor(width, size.width),
    y: stretchFactor(height, size.height),
  };
  const composedScale = Math.max(SCALE_FLOOR, scale);

  const composedTransform: ComponentTransform = {
    rotation,
    scale: composedScale,
    ...(transform?.origin !== undefined ? { origin: transform.origin } : {}),
  };

  return {
    position: composedPosition,
    size: composedSize,
    stretch: composedStretch,
    transform: composedTransform,
    opacity: clampOpacity(opacity),
    ...(sampled.color !== undefined ? { color: sampled.color } : {}),
    ...(sampled.backgroundColor !== undefined ? { backgroundColor: sampled.backgroundColor } : {}),
  };
}
