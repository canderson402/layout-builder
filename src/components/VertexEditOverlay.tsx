import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ComponentConfig } from '../types';
import {
  Vertex,
  generatePath,
  evalSegment,
  insertVertexOnSegment,
  closestTOnSegment,
} from '../shared/utils/shapePath';

interface VertexEditOverlayProps {
  component: ComponentConfig;
  scale: number; // canvas zoom factor (zoomLevel / 100)
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  snapEnabled: boolean;
  selectedVertices: number[];
  onSelectVertices: (indices: number[]) => void;
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onStartDragOperation: () => void;
  onEndDragOperation: (description: string) => void;
  onRequestExit: () => void;
}

type DragState =
  | { kind: 'vertex'; startX: number; startY: number; startVertices: Vertex[]; indices: number[]; moved: boolean }
  | { kind: 'handle'; startX: number; startY: number; startVertices: Vertex[]; index: number; side: 'hIn' | 'hOut'; moved: boolean }
  | { kind: 'marquee'; startX: number; startY: number; curX: number; curY: number };

const ACCENT = '#4FC3F7';

export default function VertexEditOverlay({
  component,
  scale,
  canvasWidth,
  canvasHeight,
  gridSize,
  snapEnabled,
  selectedVertices,
  onSelectVertices,
  onUpdateComponent,
  onStartDragOperation,
  onEndDragOperation,
  onRequestExit,
}: VertexEditOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, setTick] = useState(0); // re-render during marquee / after drag end
  const [ghost, setGhost] = useState<{ seg: number; t: number } | null>(null);

  // Close any in-flight drag's undo operation if the overlay unmounts mid-drag
  // (e.g. Escape pressed while the mouse button is still down). Unmount-only —
  // the main drag effect re-subscribes per commit and must not trigger this.
  const endDragRef = useRef(onEndDragOperation);
  endDragRef.current = onEndDragOperation;
  useEffect(() => {
    return () => {
      const drag = dragRef.current;
      if (drag && drag.kind !== 'marquee' && drag.moved) {
        endDragRef.current('Edit vertices');
      }
      dragRef.current = null;
    };
  }, []);

  const shape = component.props?.shape;
  const vertices: Vertex[] = shape?.vertices || [];
  const closed: boolean = shape?.closed !== false;
  const W = component.size.width;
  const H = component.size.height;
  const ox = component.position.x;
  const oy = component.position.y;

  // Inverse-scaled so editing chrome stays constant size on screen
  const r = 5 / scale;
  const hairline = 1.5 / scale;

  const toPx = useCallback(
    (v: { x: number; y: number }) => ({ x: ox + v.x * W, y: oy + v.y * H }),
    [ox, oy, W, H]
  );

  const canvasPoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = svgRef.current!.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    },
    [scale]
  );

  const commitVertices = useCallback(
    (next: Vertex[]) => {
      onUpdateComponent(component.id, {
        props: { ...component.props, shape: { ...component.props.shape, vertices: next } },
      });
    },
    [component.id, component.props, onUpdateComponent]
  );

  // --- mousedown entry points ------------------------------------------------

  const handleBackdropMouseDown = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // block native text/element selection (esp. on double-clicks)
    const p = canvasPoint(e);
    dragRef.current = { kind: 'marquee', startX: p.x, startY: p.y, curX: p.x, curY: p.y };
  };

  const handleVertexMouseDown = (e: ReactMouseEvent, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.shiftKey) {
      onSelectVertices(
        selectedVertices.includes(i)
          ? selectedVertices.filter(v => v !== i)
          : [...selectedVertices, i]
      );
      return;
    }
    const indices = selectedVertices.includes(i) ? selectedVertices : [i];
    if (!selectedVertices.includes(i)) onSelectVertices(indices);
    const p = canvasPoint(e);
    dragRef.current = {
      kind: 'vertex',
      startX: p.x,
      startY: p.y,
      startVertices: structuredClone(vertices),
      indices,
      moved: false,
    };
  };

  const handleHandleMouseDown = (e: ReactMouseEvent, i: number, side: 'hIn' | 'hOut') => {
    e.stopPropagation();
    e.preventDefault();
    const p = canvasPoint(e);
    dragRef.current = {
      kind: 'handle',
      startX: p.x,
      startY: p.y,
      startVertices: structuredClone(vertices),
      index: i,
      side,
      moved: false,
    };
  };

  const handleVertexDoubleClick = (e: ReactMouseEvent, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    const next = structuredClone(vertices);
    const v = next[i];
    onStartDragOperation();
    if (v.type === 'corner') {
      // Smooth: handles along the tangent through the neighbors
      const n = vertices.length;
      const prev = vertices[(i - 1 + n) % n];
      const nxt = vertices[(i + 1) % n];
      let tx = nxt.x - prev.x;
      let ty = nxt.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      tx = (tx / len) * 0.15;
      ty = (ty / len) * 0.15;
      next[i] = { ...v, type: 'smooth', hIn: { x: -tx, y: -ty }, hOut: { x: tx, y: ty } };
    } else {
      next[i] = { x: v.x, y: v.y, type: 'corner' };
    }
    commitVertices(next);
    onEndDragOperation('Toggle vertex type');
  };

  const handleSegmentMouseMove = (e: ReactMouseEvent, segIndex: number) => {
    const p = canvasPoint(e);
    const local = { x: (p.x - ox) / W, y: (p.y - oy) / H };
    const a = vertices[segIndex];
    const b = vertices[(segIndex + 1) % vertices.length];
    setGhost({ seg: segIndex, t: closestTOnSegment(a, b, local) });
  };

  const handleSegmentMouseDown = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!ghost) return;
    onStartDragOperation();
    const next = insertVertexOnSegment(vertices, closed, ghost.seg, ghost.t);
    commitVertices(next);
    onSelectVertices([ghost.seg + 1]); // the new vertex
    onEndDragOperation('Add vertex');
    setGhost(null);
  };

  // --- global drag handling ---------------------------------------------------

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = canvasPoint(e);

      if (drag.kind === 'vertex') {
        let dx = p.x - drag.startX;
        let dy = p.y - drag.startY;
        if (e.shiftKey) {
          dx *= 0.25; // precision mode
          dy *= 0.25;
        }
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 1) {
          drag.moved = true;
          onStartDragOperation();
        }
        if (!drag.moved) return;
        const next = structuredClone(drag.startVertices);
        for (const i of drag.indices) {
          let nx = drag.startVertices[i].x * W + dx; // local pixel space
          let ny = drag.startVertices[i].y * H + dy;
          if (snapEnabled && !e.altKey && drag.indices.length === 1) {
            // Snap in CANVAS space so vertices land on the same grid as components
            nx = Math.round((ox + nx) / gridSize) * gridSize - ox;
            ny = Math.round((oy + ny) / gridSize) * gridSize - oy;
          }
          next[i] = { ...next[i], x: nx / W, y: ny / H };
        }
        commitVertices(next);
        return;
      }

      if (drag.kind === 'handle') {
        const v = drag.startVertices[drag.index];
        const localX = p.x - ox; // pixel position within the component
        const localY = p.y - oy;
        const hx = (localX - v.x * W) / W; // normalized offset from the vertex
        const hy = (localY - v.y * H) / H;
        if (!drag.moved) {
          drag.moved = true;
          onStartDragOperation();
        }
        const next = structuredClone(drag.startVertices);
        const nv: Vertex = { ...next[drag.index] };
        if (e.altKey && nv.type === 'smooth') nv.type = 'broken';
        nv[drag.side] = { x: hx, y: hy };
        if (nv.type === 'smooth') {
          nv[drag.side === 'hIn' ? 'hOut' : 'hIn'] = { x: -hx, y: -hy };
        }
        next[drag.index] = nv;
        commitVertices(next);
        return;
      }

      if (drag.kind === 'marquee') {
        drag.curX = p.x;
        drag.curY = p.y;
        setTick(t => t + 1);
      }
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === 'marquee') {
        const dx = Math.abs(drag.curX - drag.startX);
        const dy = Math.abs(drag.curY - drag.startY);
        if (dx < 4 && dy < 4) {
          onRequestExit(); // plain click on empty canvas exits edit mode
        } else {
          const x1 = Math.min(drag.startX, drag.curX);
          const x2 = Math.max(drag.startX, drag.curX);
          const y1 = Math.min(drag.startY, drag.curY);
          const y2 = Math.max(drag.startY, drag.curY);
          const hit = vertices
            .map((v, i) => ({ p: toPx(v), i }))
            .filter(({ p }) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2)
            .map(({ i }) => i);
          onSelectVertices(hit);
        }
      }
      if (drag.kind === 'vertex' && drag.moved) onEndDragOperation('Move vertex');
      if (drag.kind === 'handle' && drag.moved) onEndDragOperation('Adjust curve handle');
      dragRef.current = null;
      setTick(t => t + 1);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasPoint, vertices, toPx, onSelectVertices, onRequestExit, onEndDragOperation, onStartDragOperation, commitVertices, W, H, ox, oy, gridSize, snapEnabled]);

  // Delete/Backspace removes selected vertices (component-level delete is gated off while editing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedVertices.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const minCount = closed ? 3 : 2;
        if (vertices.length - selectedVertices.length < minCount) return; // enforce minimums
        onStartDragOperation();
        commitVertices(vertices.filter((_, i) => !selectedVertices.includes(i)));
        onSelectVertices([]);
        onEndDragOperation('Delete vertex');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vertices, closed, selectedVertices, commitVertices, onSelectVertices, onStartDragOperation, onEndDragOperation]);

  if (!shape) return null;

  const marquee = dragRef.current?.kind === 'marquee' ? dragRef.current : null;
  const segCount = closed ? vertices.length : vertices.length - 1;

  return (
    <svg
      ref={svgRef}
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 3000,
        pointerEvents: 'none', // children opt back in
        overflow: 'visible',
        userSelect: 'none',
      }}
    >
      {/* Backdrop: captures clicks anywhere -> marquee or exit */}
      <rect
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'default' }}
        onMouseDown={handleBackdropMouseDown}
      />

      {/* Shape outline */}
      <path
        d={generatePath(vertices, closed, W, H)}
        transform={`translate(${ox} ${oy})`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={hairline}
        pointerEvents="none"
      />

      {/* Segment hit areas for hover/insert */}
      {Array.from({ length: segCount }, (_, i) => {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        return (
          <path
            key={`seg-${i}`}
            d={generatePath([a, b], false, W, H)}
            transform={`translate(${ox} ${oy})`}
            fill="none"
            stroke="transparent"
            strokeWidth={12 / scale}
            style={{ pointerEvents: 'stroke', cursor: 'copy' }}
            onMouseMove={e => handleSegmentMouseMove(e, i)}
            onMouseLeave={() => setGhost(null)}
            onMouseDown={handleSegmentMouseDown}
          />
        );
      })}

      {/* Ghost insert dot */}
      {ghost && (() => {
        const a = vertices[ghost.seg];
        const b = vertices[(ghost.seg + 1) % vertices.length];
        const p = toPx(evalSegment(a, b, ghost.t));
        return (
          <circle
            cx={p.x}
            cy={p.y}
            r={r * 0.9}
            fill="none"
            stroke={ACCENT}
            strokeWidth={hairline}
            strokeDasharray={`${3 / scale} ${2 / scale}`}
            pointerEvents="none"
          />
        );
      })()}

      {/* Bezier handles for selected non-corner vertices */}
      {selectedVertices.map(i => {
        const v = vertices[i];
        if (!v || v.type === 'corner') return null;
        const vp = toPx(v);
        return (['hIn', 'hOut'] as const).map(side => {
          const h = v[side];
          if (!h) return null;
          const hp = toPx({ x: v.x + h.x, y: v.y + h.y });
          return (
            <g key={`h-${i}-${side}`}>
              <line x1={vp.x} y1={vp.y} x2={hp.x} y2={hp.y} stroke="#999999" strokeWidth={hairline} pointerEvents="none" />
              <circle
                cx={hp.x}
                cy={hp.y}
                r={r * 0.75}
                fill="#ffffff"
                stroke={ACCENT}
                strokeWidth={hairline}
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onMouseDown={e => handleHandleMouseDown(e, i, side)}
              />
            </g>
          );
        });
      })}

      {/* Vertices: squares = corner, circles = smooth/broken */}
      {vertices.map((v, i) => {
        const p = toPx(v);
        const selected = selectedVertices.includes(i);
        const common = {
          fill: selected ? ACCENT : '#ffffff',
          stroke: selected ? '#ffffff' : ACCENT,
          strokeWidth: 2 / scale,
          style: { pointerEvents: 'all' as const, cursor: 'move' },
          onMouseDown: (e: ReactMouseEvent) => handleVertexMouseDown(e, i),
          onDoubleClick: (e: ReactMouseEvent) => handleVertexDoubleClick(e, i),
        };
        return v.type === 'corner' ? (
          <rect key={`v-${i}`} x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} {...common} />
        ) : (
          <circle key={`v-${i}`} cx={p.x} cy={p.y} r={r} {...common} />
        );
      })}

      {/* Marquee rectangle */}
      {marquee && (Math.abs(marquee.curX - marquee.startX) >= 4 || Math.abs(marquee.curY - marquee.startY) >= 4) && (
        <rect
          x={Math.min(marquee.startX, marquee.curX)}
          y={Math.min(marquee.startY, marquee.curY)}
          width={Math.abs(marquee.curX - marquee.startX)}
          height={Math.abs(marquee.curY - marquee.startY)}
          fill="rgba(79, 195, 247, 0.12)"
          stroke={ACCENT}
          strokeWidth={hairline}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
