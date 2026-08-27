import React from 'react';
import { sampleTrack, type AnimatableProperty, type Handle, type Keyframe } from '../shared/utils/overlayTimeline';
import {
  buildCurvePath,
  computeValueRange,
  handleFromPoint,
  handlePoint,
  nearestCurvePoint,
  panRange,
  valuePerPixel,
  valueToY,
  yToValue,
  zoomRange,
  type ValueRange,
} from '../utils/graphGeometry';

export interface GraphRow {
  componentId: string;
  componentLabel: string;
  property: AnimatableProperty;
  keyframes: Keyframe[];
}

export interface GraphSelection {
  componentId: string;
  property: AnimatableProperty;
  frame: number;
}

export interface ChannelRef {
  componentId: string;
  property: AnimatableProperty;
}

export const CHANNEL_COLORS: Partial<Record<AnimatableProperty, string>> = {
  x: '#e06c75',
  y: '#98c379',
  width: '#61afef',
  height: '#56b6c2',
  rotation: '#e5c07b',
  scale: '#c678dd',
  opacity: '#abb2bf',
};

const FALLBACK_COLOR = '#888888';
const PRECISION_FACTOR = 0.25;
const ZOOM_IN = 0.9;
const ZOOM_OUT = 1.1;
const GRID_LINES = 6;
const CURVE_GRAB_PX = 26;

export function channelColor(property: AnimatableProperty): string {
  return CHANNEL_COLORS[property] ?? FALLBACK_COLOR;
}

function isNumeric(keyframe: Keyframe): boolean {
  return typeof keyframe.value === 'number' && Number.isFinite(keyframe.value);
}

function sameChannel(a: ChannelRef | null, b: ChannelRef | null): boolean {
  return !!a && !!b && a.componentId === b.componentId && a.property === b.property;
}

function gridStep(span: number): number {
  if (!(span > 0)) return 1;
  const rough = span / GRID_LINES;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const snapped = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return snapped * magnitude;
}

function formatValue(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return value.toFixed(decimals);
}

type DragKind = 'keyframe' | 'handle' | 'pan';

interface DragState {
  kind: DragKind;
  side?: 'in' | 'out';
  componentId?: string;
  property?: AnimatableProperty;
  frame?: number;
  startValue?: number;
  startFrame?: number;
  originX: number;
  originY: number;
  rangeAtStart: ValueRange;
}

interface CurveProps {
  row: GraphRow;
  range: ValueRange;
  height: number;
  pixelsPerFrame: number;
  originFrame: number;
  active: boolean;
}

const Curve = React.memo(({ row, range, height, pixelsPerFrame, originFrame, active }: CurveProps) => {
  const path = buildCurvePath(row.keyframes, range, height, pixelsPerFrame, originFrame);
  if (!path) return null;
  return (
    <path
      d={path}
      fill="none"
      stroke={channelColor(row.property)}
      strokeWidth={active ? 2 : 1}
      opacity={active ? 1 : 0.25}
      strokeDasharray={active ? undefined : '4 3'}
    />
  );
});
Curve.displayName = 'Curve';

interface HandleArmProps {
  keyframe: Keyframe;
  handle: Handle | undefined;
  side: 'in' | 'out';
  range: ValueRange;
  height: number;
  pixelsPerFrame: number;
  originFrame: number;
  color: string;
  onPointerDown: (e: React.PointerEvent, side: 'in' | 'out') => void;
}

const HandleArm = React.memo(({
  keyframe, handle, side, range, height, pixelsPerFrame, originFrame, color, onPointerDown,
}: HandleArmProps) => {
  const point = handlePoint(keyframe, handle, range, height, pixelsPerFrame, originFrame);
  if (!point || !isNumeric(keyframe)) return null;

  const kx = (keyframe.frame - originFrame) * pixelsPerFrame;
  const ky = valueToY(keyframe.value as number, range, height);

  return (
    <g>
      <line x1={kx} y1={ky} x2={point.x} y2={point.y} stroke={color} strokeWidth={1} opacity={0.9} />
      <rect
        x={point.x - 4}
        y={point.y - 4}
        width={8}
        height={8}
        fill="#1e1e1e"
        stroke={color}
        strokeWidth={2}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, side)}
        aria-label={`${side} handle at frame ${keyframe.frame}`}
      />
    </g>
  );
});
HandleArm.displayName = 'HandleArm';

interface KeyframeDotProps {
  row: GraphRow;
  keyframe: Keyframe;
  range: ValueRange;
  height: number;
  pixelsPerFrame: number;
  originFrame: number;
  selected: boolean;
  active: boolean;
  onPointerDown: (e: React.PointerEvent, row: GraphRow, keyframe: Keyframe) => void;
}

const KeyframeDot = React.memo(({
  row, keyframe, range, height, pixelsPerFrame, originFrame, selected, active, onPointerDown,
}: KeyframeDotProps) => {
  if (!isNumeric(keyframe)) return null;
  const cx = (keyframe.frame - originFrame) * pixelsPerFrame;
  const cy = valueToY(keyframe.value as number, range, height);
  const color = channelColor(row.property);
  const r = selected ? 6 : active ? 4.5 : 3;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={selected ? '#ffffff' : active ? color : '#1e1e1e'}
      stroke={color}
      strokeWidth={2}
      opacity={active ? 1 : 0.5}
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => onPointerDown(e, row, keyframe)}
      aria-label={`${row.property} keyframe at frame ${keyframe.frame}, value ${keyframe.value}`}
    />
  );
});
KeyframeDot.displayName = 'KeyframeDot';

export interface GraphEditorProps {
  rows: GraphRow[];
  activeChannel: ChannelRef | null;
  onActivateChannel: (channel: ChannelRef) => void;
  width: number;
  height: number;
  pixelsPerFrame: number;
  originFrame: number;
  currentFrame: number;
  selectedKeyframe: GraphSelection | null;
  onSelectKeyframe: (selection: GraphSelection | null) => void;
  onRetimeKeyframe: (componentId: string, property: AnimatableProperty, fromFrame: number, toFrame: number) => void;
  onSetKeyframeValue: (componentId: string, property: AnimatableProperty, frame: number, value: number) => void;
  onSetKeyframeHandle: (componentId: string, property: AnimatableProperty, frame: number, side: 'in' | 'out', handle: Handle) => void;
  onInsertOnCurve: (componentId: string, property: AnimatableProperty, frame: number) => void;
  onBeginKeyframeGesture: () => void;
  onEndKeyframeGesture: () => void;
  clampFrame: (frame: number) => number;
  fitSignal: number;
}

const GraphEditor = ({
  rows,
  activeChannel,
  onActivateChannel,
  width,
  height,
  pixelsPerFrame,
  originFrame,
  currentFrame,
  selectedKeyframe,
  onSelectKeyframe,
  onRetimeKeyframe,
  onSetKeyframeValue,
  onSetKeyframeHandle,
  clampFrame,
  fitSignal,
  onInsertOnCurve,
  onBeginKeyframeGesture,
  onEndKeyframeGesture,
}: GraphEditorProps) => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);

  const activeRow = React.useMemo(
    () => rows.find(r => sameChannel(activeChannel, r)) ?? null,
    [rows, activeChannel],
  );

  const fitToActive = React.useCallback((): ValueRange => {
    if (!activeRow) return computeValueRange([]);
    return computeValueRange([{
      componentId: activeRow.componentId,
      property: activeRow.property,
      keyframes: activeRow.keyframes,
    }]);
  }, [activeRow]);

  const [range, setRange] = React.useState<ValueRange>(() => fitToActive());

  const fitKeyRef = React.useRef<string>('');
  const channelKey = activeChannel ? `${activeChannel.componentId}:${activeChannel.property}` : '';

  React.useEffect(() => {
    const key = `${channelKey}|${fitSignal}`;
    if (fitKeyRef.current === key) return;
    fitKeyRef.current = key;
    setRange(fitToActive());
  }, [channelKey, fitSignal, fitToActive]);

  const selectedKf = React.useMemo(() => {
    if (!selectedKeyframe) return null;
    const row = rows.find(r => sameChannel(selectedKeyframe, r));
    return row?.keyframes.find(k => k.frame === selectedKeyframe.frame) ?? null;
  }, [rows, selectedKeyframe]);

  const selectionKey = selectedKeyframe
    ? `${selectedKeyframe.componentId}:${selectedKeyframe.property}:${selectedKeyframe.frame}`
    : '';

  React.useEffect(() => {
    if (!selectedKf) return;
    if (typeof selectedKf.value !== 'number') return;
    const tips = [selectedKf.handleIn, selectedKf.handleOut]
      .filter((h): h is Handle => !!h && Number.isFinite(h.dValue))
      .map(h => (selectedKf.value as number) + h.dValue);
    if (tips.length === 0) return;

    setRange(prev => {
      const lo = Math.min(prev.min, ...tips);
      const hi = Math.max(prev.max, ...tips);
      if (lo === prev.min && hi === prev.max) return prev;
      const pad = (hi - lo) * 0.05;
      return { min: lo - pad, max: hi + pad };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const localPoint = React.useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const beginDrag = React.useCallback((e: React.PointerEvent, state: Omit<DragState, 'originX' | 'originY' | 'rangeAtStart'>) => {
    const point = localPoint(e.clientX, e.clientY);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { ...state, originX: point.x, originY: point.y, rangeAtStart: range };
    if (state.kind !== 'pan') onBeginKeyframeGesture();
  }, [localPoint, range, onBeginKeyframeGesture]);

  const handleKeyframePointerDown = React.useCallback((e: React.PointerEvent, row: GraphRow, keyframe: Keyframe) => {
    e.stopPropagation();
    e.preventDefault();
    if (!sameChannel(activeChannel, row)) {
      onActivateChannel({ componentId: row.componentId, property: row.property });
    }
    onSelectKeyframe({ componentId: row.componentId, property: row.property, frame: keyframe.frame });
    beginDrag(e, {
      kind: 'keyframe',
      componentId: row.componentId,
      property: row.property,
      frame: keyframe.frame,
      startFrame: keyframe.frame,
      startValue: typeof keyframe.value === 'number' ? keyframe.value : 0,
    });
  }, [activeChannel, onActivateChannel, onSelectKeyframe, beginDrag]);

  const handleHandlePointerDown = React.useCallback((e: React.PointerEvent, side: 'in' | 'out') => {
    if (!selectedKeyframe) return;
    e.stopPropagation();
    e.preventDefault();
    beginDrag(e, {
      kind: 'handle',
      side,
      componentId: selectedKeyframe.componentId,
      property: selectedKeyframe.property,
      frame: selectedKeyframe.frame,
    });
  }, [selectedKeyframe, beginDrag]);

  const findCurveTarget = React.useCallback((clientX: number, clientY: number) => {
    if (rows.length === 0) return null;
    const point = localPoint(clientX, clientY);

    const nearest = nearestCurvePoint(
      rows.map(r => ({ componentId: r.componentId, property: r.property, keyframes: r.keyframes })),
      point.x,
      point.y,
      { range, height, pixelsPerFrame, originFrame },
    );

    if (!nearest || nearest.distance > CURVE_GRAB_PX) return null;
    const row = rows.find(
      r => r.componentId === nearest.track.componentId && r.property === nearest.track.property,
    );
    if (!row) return null;

    const frame = clampFrame(Math.round(point.x / pixelsPerFrame + originFrame));
    const existing = row.keyframes.find(k => k.frame === frame);

    const value = existing
      ? existing.value
      : sampleTrack(
          { componentId: row.componentId, property: row.property, keyframes: row.keyframes },
          frame,
        );
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    return { row, frame, value, existing: !!existing };
  }, [rows, localPoint, range, height, pixelsPerFrame, originFrame, clampFrame]);

  const handleBackgroundPointerDown = React.useCallback((e: React.PointerEvent) => {
    const target = findCurveTarget(e.clientX, e.clientY);

    if (!target) {
      onSelectKeyframe(null);
      beginDrag(e, { kind: 'pan' });
      return;
    }

    const { row, frame, value, existing } = target;
    if (!sameChannel(activeChannel, row)) {
      onActivateChannel({ componentId: row.componentId, property: row.property });
    }
    if (!existing) {
      onInsertOnCurve(row.componentId, row.property, frame);
    }
    onSelectKeyframe({ componentId: row.componentId, property: row.property, frame });
    beginDrag(e, {
      kind: 'keyframe',
      componentId: row.componentId,
      property: row.property,
      frame,
      startFrame: frame,
      startValue: value,
    });
  }, [findCurveTarget, activeChannel, onActivateChannel, onInsertOnCurve, onSelectKeyframe, beginDrag]);

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.buttons !== 1) return;
    const point = localPoint(e.clientX, e.clientY);

    if (drag.kind === 'pan') {
      const dy = point.y - drag.originY;
      setRange(panRange(drag.rangeAtStart, dy * valuePerPixel(drag.rangeAtStart, height)));
      return;
    }

    if (drag.kind === 'keyframe') {
      const scale = e.shiftKey ? PRECISION_FACTOR : 1;
      const dyValue = (point.y - drag.originY) * valuePerPixel(drag.rangeAtStart, height) * scale;
      onSetKeyframeValue(drag.componentId!, drag.property!, drag.frame!, drag.startValue! - dyValue);

      const dxFrames = ((point.x - drag.originX) / pixelsPerFrame) * scale;
      const nextFrame = clampFrame(Math.round(drag.startFrame! + dxFrames));
      if (nextFrame !== drag.frame) {
        onRetimeKeyframe(drag.componentId!, drag.property!, drag.frame!, nextFrame);
        drag.frame = nextFrame;
        onSelectKeyframe({ componentId: drag.componentId!, property: drag.property!, frame: nextFrame });
      }
      return;
    }

    const row = rows.find(r => r.componentId === drag.componentId && r.property === drag.property);
    const keyframe = row?.keyframes.find(k => k.frame === drag.frame);
    if (!keyframe) return;
    const next = handleFromPoint(keyframe, point, drag.rangeAtStart, height, pixelsPerFrame, originFrame);
    if (!next) return;
    onSetKeyframeHandle(drag.componentId!, drag.property!, drag.frame!, drag.side!, next);
  }, [
    localPoint, height, pixelsPerFrame, originFrame, clampFrame,
    onSetKeyframeValue, onRetimeKeyframe, onSelectKeyframe, onSetKeyframeHandle, rows, findCurveTarget,
  ]);

  const endDrag = React.useCallback((e: React.PointerEvent) => {
    if (svgRef.current?.hasPointerCapture?.(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    const wasEditing = dragRef.current !== null && dragRef.current.kind !== 'pan';
    dragRef.current = null;
    if (wasEditing) onEndKeyframeGesture();
  }, [onEndKeyframeGesture]);

  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const point = localPoint(e.clientX, e.clientY);
    const focus = yToValue(point.y, range, height);
    setRange(zoomRange(range, focus, e.deltaY > 0 ? ZOOM_OUT : ZOOM_IN));
  }, [localPoint, range, height]);

  const step = gridStep(range.max - range.min);
  const gridValues = React.useMemo(() => {
    const first = Math.ceil(range.min / step) * step;
    const out: number[] = [];
    for (let v = first; v <= range.max; v += step) out.push(v);
    return out;
  }, [range, step]);

  const playheadX = (currentFrame - originFrame) * pixelsPerFrame;

  return (
    <svg
      ref={svgRef}
      className="graph-editor"
      width={width}
      height={height}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onWheel={handleWheel}
      role="img"
      aria-label="Animation curves"
    >
      <rect x={0} y={0} width={width} height={height} fill="#202020" />

      {gridValues.map(value => {
        const y = valueToY(value, range, height);
        const isZero = Math.abs(value) < step / 1000;
        return (
          <g key={value}>
            <line x1={0} y1={y} x2={width} y2={y} stroke={isZero ? '#4a4a4a' : '#2e2e2e'} strokeWidth={1} />
            <text x={4} y={y - 3} fill="#8a8a8a" fontSize={10} style={{ pointerEvents: 'none' }}>
              {formatValue(value, step)}
            </text>
          </g>
        );
      })}

      {rows.map(row => (
        <Curve
          key={`${row.componentId}:${row.property}`}
          row={row}
          range={range}
          height={height}
          pixelsPerFrame={pixelsPerFrame}
          originFrame={originFrame}
          active={sameChannel(activeChannel, row)}
        />
      ))}

      {selectedKf && selectedKf.interpolation === 'bezier' && selectedKeyframe && (
        <>
          <HandleArm
            keyframe={selectedKf}
            handle={selectedKf.handleIn}
            side="in"
            range={range}
            height={height}
            pixelsPerFrame={pixelsPerFrame}
            originFrame={originFrame}
            color={channelColor(selectedKeyframe.property)}
            onPointerDown={handleHandlePointerDown}
          />
          <HandleArm
            keyframe={selectedKf}
            handle={selectedKf.handleOut}
            side="out"
            range={range}
            height={height}
            pixelsPerFrame={pixelsPerFrame}
            originFrame={originFrame}
            color={channelColor(selectedKeyframe.property)}
            onPointerDown={handleHandlePointerDown}
          />
        </>
      )}

      {rows.map(row =>
        row.keyframes.map(keyframe => (
          <KeyframeDot
            key={`${row.componentId}:${row.property}:${keyframe.frame}`}
            row={row}
            keyframe={keyframe}
            range={range}
            height={height}
            pixelsPerFrame={pixelsPerFrame}
            originFrame={originFrame}
            active={sameChannel(activeChannel, row)}
            selected={
              !!selectedKeyframe &&
              selectedKeyframe.componentId === row.componentId &&
              selectedKeyframe.property === row.property &&
              selectedKeyframe.frame === keyframe.frame
            }
            onPointerDown={handleKeyframePointerDown}
          />
        )),
      )}

      <line x1={playheadX} y1={0} x2={playheadX} y2={height} stroke="#4CAF50" strokeWidth={1} style={{ pointerEvents: 'none' }} />
    </svg>
  );
};

export default GraphEditor;
