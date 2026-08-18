import { ComponentTransform } from '../shared/utils/componentTransform';
import { transformPoint, inverseTransformPoint } from './transformBounds';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface Point { x: number; y: number }
interface Size { width: number; height: number }

const MOVING_EDGES: Record<ResizeHandle, { left: boolean; right: boolean; top: boolean; bottom: boolean }> = {
  nw: { left: true, right: false, top: true, bottom: false },
  ne: { left: false, right: true, top: true, bottom: false },
  sw: { left: true, right: false, top: false, bottom: true },
  se: { left: false, right: true, top: false, bottom: true },
  n: { left: false, right: false, top: true, bottom: false },
  s: { left: false, right: false, top: false, bottom: true },
  e: { left: false, right: true, top: false, bottom: false },
  w: { left: true, right: false, top: false, bottom: false },
};

export function movesEdges(handle: ResizeHandle) {
  return MOVING_EDGES[handle];
}

export function anchorForHandle(handle: ResizeHandle, width: number, height: number): Point {
  const m = MOVING_EDGES[handle];
  const x = m.left ? width : m.right ? 0 : width / 2;
  const y = m.top ? height : m.bottom ? 0 : height / 2;
  return { x, y };
}

export function pointerToLocal(
  canvasX: number,
  canvasY: number,
  position: Point,
  size: Size,
  transform: ComponentTransform | undefined,
): Point {
  return inverseTransformPoint(
    canvasX - position.x,
    canvasY - position.y,
    transform,
    size.width,
    size.height,
  );
}

export function positionAfterResize(
  oldPosition: Point,
  oldSize: Size,
  newSize: Size,
  handle: ResizeHandle,
  transform: ComponentTransform | undefined,
): Point {
  const a0 = anchorForHandle(handle, oldSize.width, oldSize.height);
  const a1 = anchorForHandle(handle, newSize.width, newSize.height);
  const before = transformPoint(a0.x, a0.y, transform, oldSize.width, oldSize.height);
  const after = transformPoint(a1.x, a1.y, transform, newSize.width, newSize.height);
  return {
    x: oldPosition.x + before.x - after.x,
    y: oldPosition.y + before.y - after.y,
  };
}
