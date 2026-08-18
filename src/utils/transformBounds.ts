import { ComponentTransform, resolveOrigin } from '../shared/utils/componentTransform';

const DEG = Math.PI / 180;

export function transformPoint(
  px: number,
  py: number,
  t: ComponentTransform | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!t) return { x: px, y: py };
  const rotation = t.rotation ?? 0;
  const scale = t.scale ?? 1;
  const origin = resolveOrigin(t.origin, width, height);

  const dx = (px - origin.x) * scale;
  const dy = (py - origin.y) * scale;
  const cos = Math.cos(rotation * DEG);
  const sin = Math.sin(rotation * DEG);

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export function inverseTransformPoint(
  px: number,
  py: number,
  t: ComponentTransform | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!t) return { x: px, y: py };
  const rotation = t.rotation ?? 0;
  const scale = t.scale ?? 1;
  const origin = resolveOrigin(t.origin, width, height);

  const dx = px - origin.x;
  const dy = py - origin.y;
  const cos = Math.cos(-rotation * DEG);
  const sin = Math.sin(-rotation * DEG);

  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  if (!Number.isFinite(scale) || scale <= 0) {
    return { x: origin.x, y: origin.y };
  }

  return {
    x: origin.x + rx / scale,
    y: origin.y + ry / scale,
  };
}

export function transformedCorners(
  t: ComponentTransform | undefined,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  if (!t) return corners;
  return corners.map(c => transformPoint(c.x, c.y, t, width, height));
}

export function containsPoint(
  localX: number,
  localY: number,
  t: ComponentTransform | undefined,
  width: number,
  height: number,
): boolean {
  const scale = t?.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) return false;
  const p = inverseTransformPoint(localX, localY, t, width, height);
  return p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
}
