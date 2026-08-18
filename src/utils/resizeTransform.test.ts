import { describe, it, expect } from 'vitest';
import {
  pointerToLocal,
  anchorForHandle,
  positionAfterResize,
  movesEdges,
  ResizeHandle,
} from './resizeTransform';
import { transformPoint } from './transformBounds';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('movesEdges', () => {
  it('maps corner handles to two moving edges', () => {
    expect(movesEdges('se')).toEqual({ left: false, right: true, top: false, bottom: true });
    expect(movesEdges('nw')).toEqual({ left: true, right: false, top: true, bottom: false });
    expect(movesEdges('ne')).toEqual({ left: false, right: true, top: true, bottom: false });
    expect(movesEdges('sw')).toEqual({ left: true, right: false, top: false, bottom: true });
  });

  it('maps edge handles to exactly one moving edge', () => {
    expect(movesEdges('e')).toEqual({ left: false, right: true, top: false, bottom: false });
    expect(movesEdges('w')).toEqual({ left: true, right: false, top: false, bottom: false });
    expect(movesEdges('n')).toEqual({ left: false, right: false, top: true, bottom: false });
    expect(movesEdges('s')).toEqual({ left: false, right: false, top: false, bottom: true });
  });
});

describe('anchorForHandle', () => {
  it('anchors a corner handle at the opposite corner', () => {
    expect(anchorForHandle('se', 100, 60)).toEqual({ x: 0, y: 0 });
    expect(anchorForHandle('nw', 100, 60)).toEqual({ x: 100, y: 60 });
    expect(anchorForHandle('ne', 100, 60)).toEqual({ x: 0, y: 60 });
    expect(anchorForHandle('sw', 100, 60)).toEqual({ x: 100, y: 0 });
  });

  it('anchors an edge handle at the midpoint of the opposite edge', () => {
    expect(anchorForHandle('e', 100, 60)).toEqual({ x: 0, y: 30 });
    expect(anchorForHandle('w', 100, 60)).toEqual({ x: 100, y: 30 });
    expect(anchorForHandle('n', 100, 60)).toEqual({ x: 50, y: 60 });
    expect(anchorForHandle('s', 100, 60)).toEqual({ x: 50, y: 0 });
  });
});

describe('pointerToLocal', () => {
  const position = { x: 200, y: 100 };
  const size = { width: 100, height: 60 };

  it('is a plain offset for an untransformed component', () => {
    const p = pointerToLocal(250, 130, position, size, undefined);
    near(p.x, 50);
    near(p.y, 30);
  });

  it('undoes a 90 degree rotation about the center', () => {
    const p = pointerToLocal(250, 180, position, size, { rotation: 90 });
    near(p.x, 100);
    near(p.y, 30);
  });

  it('undoes scale about the center', () => {
    const p = pointerToLocal(300, 130, position, size, { scale: 2 });
    near(p.x, 75);
    near(p.y, 30);
  });
});

describe('positionAfterResize', () => {
  const oldPosition = { x: 200, y: 100 };
  const oldSize = { width: 100, height: 60 };

  it('leaves position untouched for an untransformed se drag', () => {
    const p = positionAfterResize(oldPosition, oldSize, { width: 140, height: 90 }, 'se', undefined);
    near(p.x, 200);
    near(p.y, 100);
  });

  it('keeps the anchored corner visually fixed for a rotated se drag', () => {
    const t = { rotation: 30 };
    const newSize = { width: 140, height: 90 };
    const p = positionAfterResize(oldPosition, oldSize, newSize, 'se', t);
    const anchorOld = anchorForHandle('se', oldSize.width, oldSize.height);
    const anchorNew = anchorForHandle('se', newSize.width, newSize.height);
    const beforeCanvas = {
      x: oldPosition.x + transformPoint(anchorOld.x, anchorOld.y, t, oldSize.width, oldSize.height).x,
      y: oldPosition.y + transformPoint(anchorOld.x, anchorOld.y, t, oldSize.width, oldSize.height).y,
    };
    const afterCanvas = {
      x: p.x + transformPoint(anchorNew.x, anchorNew.y, t, newSize.width, newSize.height).x,
      y: p.y + transformPoint(anchorNew.x, anchorNew.y, t, newSize.width, newSize.height).y,
    };
    near(afterCanvas.x, beforeCanvas.x);
    near(afterCanvas.y, beforeCanvas.y);
  });

  it('keeps the anchored edge midpoint fixed for a rotated e drag', () => {
    const t = { rotation: 45, scale: 1.25, origin: 'top-left' as const };
    const newSize = { width: 180, height: 60 };
    const p = positionAfterResize(oldPosition, oldSize, newSize, 'e', t);
    const a0 = anchorForHandle('e', oldSize.width, oldSize.height);
    const a1 = anchorForHandle('e', newSize.width, newSize.height);
    const b = transformPoint(a0.x, a0.y, t, oldSize.width, oldSize.height);
    const a = transformPoint(a1.x, a1.y, t, newSize.width, newSize.height);
    near(p.x + a.x, oldPosition.x + b.x);
    near(p.y + a.y, oldPosition.y + b.y);
  });

  it('keeps every handle\'s anchor visually fixed under a rotated, scaled, off-center-origin resize', () => {
    const t = { rotation: 37, scale: 1.6, origin: 'top-left' as const };
    const newSize = { width: 150, height: 95 };
    const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

    for (const handle of handles) {
      const p = positionAfterResize(oldPosition, oldSize, newSize, handle, t);
      const a0 = anchorForHandle(handle, oldSize.width, oldSize.height);
      const a1 = anchorForHandle(handle, newSize.width, newSize.height);

      const m = movesEdges(handle);
      expect(a0.x).toBe(m.left ? oldSize.width : m.right ? 0 : oldSize.width / 2);
      expect(a0.y).toBe(m.top ? oldSize.height : m.bottom ? 0 : oldSize.height / 2);

      const before = transformPoint(a0.x, a0.y, t, oldSize.width, oldSize.height);
      const after = transformPoint(a1.x, a1.y, t, newSize.width, newSize.height);

      near(p.x + after.x, oldPosition.x + before.x);
      near(p.y + after.y, oldPosition.y + before.y);
    }
  });
});
