export type TransformOrigin =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ComponentTransform {
  rotation?: number;
  scale?: number;
  origin?: TransformOrigin;
}

export type NativeTransformEntry =
  | { translateX: number }
  | { translateY: number }
  | { rotate: string }
  | { scale: number }
  | { scaleX: number }
  | { scaleY: number };

const ORIGIN_FACTORS: Record<TransformOrigin, { fx: number; fy: number }> = {
  'top-left': { fx: 0, fy: 0 },
  top: { fx: 0.5, fy: 0 },
  'top-right': { fx: 1, fy: 0 },
  left: { fx: 0, fy: 0.5 },
  center: { fx: 0.5, fy: 0.5 },
  right: { fx: 1, fy: 0.5 },
  'bottom-left': { fx: 0, fy: 1 },
  bottom: { fx: 0.5, fy: 1 },
  'bottom-right': { fx: 1, fy: 1 },
};

export function isIdentityTransform(t: ComponentTransform | undefined): boolean {
  if (!t) return true;
  const rotation = t.rotation ?? 0;
  const scale = t.scale ?? 1;
  return rotation === 0 && scale === 1;
}

export function isDefaultTransform(t: ComponentTransform | undefined): boolean {
  if (!t) return true;
  const origin = t.origin ?? 'center';
  return isIdentityTransform(t) && origin === 'center';
}

export function resolveOrigin(
  origin: TransformOrigin | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  const { fx, fy } = ORIGIN_FACTORS[origin ?? 'center'] ?? ORIGIN_FACTORS.center;
  return { x: width * fx, y: height * fy };
}

export function buildNativeTransform(
  t: ComponentTransform | undefined,
  width: number,
  height: number,
): NativeTransformEntry[] | undefined {
  if (isIdentityTransform(t)) return undefined;
  const rotation = t!.rotation ?? 0;
  const scale = t!.scale ?? 1;
  const origin = resolveOrigin(t!.origin, width, height);
  const dx = origin.x - width / 2;
  const dy = origin.y - height / 2;

  const core: NativeTransformEntry[] = [{ rotate: `${rotation}deg` }, { scale }];
  if (dx === 0 && dy === 0) return core;

  return [
    { translateX: dx },
    { translateY: dy },
    ...core,
    { translateX: -dx },
    { translateY: -dy },
  ];
}

export interface Stretch {
  x: number;
  y: number;
}

function hasStretch(stretch: Stretch | undefined): boolean {
  return stretch !== undefined && (stretch.x !== 1 || stretch.y !== 1);
}

export function buildCssTransform(
  t: ComponentTransform | undefined,
  stretch?: Stretch,
): string | undefined {
  const stretched = hasStretch(stretch);
  if (isIdentityTransform(t) && !stretched) return undefined;
  const parts = [`rotate(${t?.rotation ?? 0}deg)`, `scale(${t?.scale ?? 1})`];
  if (stretched) {
    parts.push(`scaleX(${stretch!.x})`, `scaleY(${stretch!.y})`);
  }
  return parts.join(' ');
}

export function buildCssTransformOrigin(
  t: ComponentTransform | undefined,
  width: number,
  height: number,
  stretch?: Stretch,
): string | undefined {
  if (isIdentityTransform(t) && !hasStretch(stretch)) return undefined;
  const origin = resolveOrigin(t?.origin, width, height);
  return `${origin.x}px ${origin.y}px`;
}
