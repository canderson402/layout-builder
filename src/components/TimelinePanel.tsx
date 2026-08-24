import React from 'react';
import type { OverlayConfig, AnimatableProperty, AnimationTrack, Handle, HandleMode, Interpolation, Keyframe } from '../shared/utils/overlayTimeline';
import GraphEditor, { channelColor, type ChannelRef } from './GraphEditor';
import { useCollapsibleState } from './common/CollapsibleSection';

const MIN_PIXELS_PER_FRAME = 1;
const MAX_PIXELS_PER_FRAME = 20;
const DEFAULT_PIXELS_PER_FRAME = 4;
const ZOOM_STEP = 1;
const MIN_FPS = 1;
const MAX_FPS = 240;
const LABEL_COLUMN_WIDTH = 160;

interface DebouncedNumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  'aria-label'?: string;
}

const DebouncedNumberInput = React.memo(({ value, onCommit, min, max, className, ...rest }: DebouncedNumberInputProps) => {
  const [localValue, setLocalValue] = React.useState(String(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(String(value));
    }
  }, [value]);

  const commit = React.useCallback(() => {
    const parsed = parseInt(localValue, 10);
    if (Number.isNaN(parsed)) {
      setLocalValue(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    onCommit(clamped);
    setLocalValue(String(clamped));
  }, [localValue, onCommit, min, max, value]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      inputRef.current?.blur();
    }
  }, [commit]);

  return (
    <input
      ref={inputRef}
      type="number"
      className={className}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      {...rest}
    />
  );
});

DebouncedNumberInput.displayName = 'DebouncedNumberInput';

function frameToPixels(frame: number, pixelsPerFrame: number): number {
  return frame * pixelsPerFrame;
}

const MAJOR_TICK_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const MIN_MAJOR_LABEL_GAP_PX = 50;
const MIN_MINOR_TICK_GAP_PX = 4;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function chooseMajorStep(pixelsPerFrame: number): number {
  for (const step of MAJOR_TICK_STEPS) {
    if (step * pixelsPerFrame >= MIN_MAJOR_LABEL_GAP_PX) return step;
  }
  return MAJOR_TICK_STEPS[MAJOR_TICK_STEPS.length - 1];
}

function chooseMinorStep(majorStep: number, pixelsPerFrame: number): number | null {
  const divisions = majorStep % 5 === 0 ? 5 : majorStep % 2 === 0 ? 2 : 1;
  if (divisions === 1) return null;
  const minorStep = majorStep / divisions;
  if (minorStep * pixelsPerFrame < MIN_MINOR_TICK_GAP_PX) return null;
  return minorStep;
}

function computeOutOfRangePad(rangeLengthFrames: number): number {
  return Math.max(10, Math.round(rangeLengthFrames * 0.25));
}

function clampFrame(frame: number, rangeStart: number, rangeEnd: number): number {
  return Math.min(rangeEnd, Math.max(rangeStart, frame));
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function collectKeyframeFrames(tracks: AnimationTrack[], selectedComponentIds: string[]): number[] {
  const relevant = selectedComponentIds.length > 0
    ? tracks.filter(t => selectedComponentIds.includes(t.componentId))
    : tracks;
  const frames = new Set<number>();
  for (const track of relevant) {
    for (const kf of track.keyframes) frames.add(kf.frame);
  }
  return Array.from(frames).sort((a, b) => a - b);
}

function findAdjacentKeyframe(frames: number[], currentFrame: number, direction: 1 | -1): number | null {
  if (direction === 1) {
    for (const frame of frames) {
      if (frame > currentFrame) return frame;
    }
    return null;
  }
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i] < currentFrame) return frames[i];
  }
  return null;
}

interface RulerTick {
  frame: number;
  isMajor: boolean;
}

function computeTicks(rangeStart: number, rangeEnd: number, pixelsPerFrame: number): { ticks: RulerTick[]; majorStep: number } {
  const majorStep = chooseMajorStep(pixelsPerFrame);
  const minorStep = chooseMinorStep(majorStep, pixelsPerFrame);
  const step = minorStep ?? majorStep;
  const alignedStart = rangeStart - mod(rangeStart, step);
  const ticks: RulerTick[] = [];
  for (let frame = alignedStart; frame <= rangeEnd; frame += step) {
    ticks.push({ frame, isMajor: mod(frame, majorStep) === 0 });
  }
  return { ticks, majorStep };
}

interface ComponentLabel {
  id: string;
  displayName?: string;
  type?: string;
}

interface SelectedKeyframe {
  componentId: string;
  property: AnimatableProperty;
  frame: number;
}

interface TrackRow {
  componentId: string;
  componentLabel: string;
  property: AnimatableProperty;
  keyframes: Keyframe[];
}

interface KeyframeDiamondProps {
  frame: number;
  pixelsPerFrame: number;
  frameOffset: number;
  selected: boolean;
  property: AnimatableProperty;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const KeyframeDiamond = React.memo(({
  frame,
  pixelsPerFrame,
  frameOffset,
  selected,
  property,
  onPointerDown,
}: KeyframeDiamondProps) => {
  return (
    <div
      className={`timeline-keyframe-diamond${selected ? ' timeline-keyframe-diamond-selected' : ''}`}
      style={{ left: frameToPixels(frame + frameOffset, pixelsPerFrame) }}
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      aria-label={`${property} keyframe at frame ${frame}${selected ? ', selected' : ''}`}
    />
  );
});

KeyframeDiamond.displayName = 'KeyframeDiamond';

interface DopeSheetRowProps {
  row: TrackRow;
  pixelsPerFrame: number;
  frameOffset: number;
  trackWidth: number;
  selectedKeyframe: SelectedKeyframe | null;
  onKeyframePointerDown: (e: React.PointerEvent<HTMLDivElement>, componentId: string, property: AnimatableProperty, frame: number) => void;
  onLanePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLanePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLanePointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLaneLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const DopeSheetRow = React.memo(({
  row,
  pixelsPerFrame,
  frameOffset,
  trackWidth,
  selectedKeyframe,
  onKeyframePointerDown,
  onLanePointerMove,
  onLanePointerUp,
  onLanePointerCancel,
  onLaneLostPointerCapture,
}: DopeSheetRowProps) => {
  return (
    <div className="dope-sheet-row">
      <div
        className="dope-sheet-row-label"
        style={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0 }}
        onPointerDown={(e) => e.stopPropagation()}
        title={row.property}
      >
        {row.property}
      </div>
      <div
        className="dope-sheet-row-lane"
        style={{ width: trackWidth }}
        onPointerMove={onLanePointerMove}
        onPointerUp={onLanePointerUp}
        onPointerCancel={onLanePointerCancel}
        onLostPointerCapture={onLaneLostPointerCapture}
      >
        {row.keyframes.map((kf, index) => (
          <KeyframeDiamond
            key={`${row.componentId}:${row.property}:${index}`}
            frame={kf.frame}
            pixelsPerFrame={pixelsPerFrame}
            frameOffset={frameOffset}
            property={row.property}
            selected={
              !!selectedKeyframe &&
              selectedKeyframe.componentId === row.componentId &&
              selectedKeyframe.property === row.property &&
              selectedKeyframe.frame === kf.frame
            }
            onPointerDown={(e) => onKeyframePointerDown(e, row.componentId, row.property, kf.frame)}
          />
        ))}
      </div>
    </div>
  );
});

DopeSheetRow.displayName = 'DopeSheetRow';

interface ChannelGroupData {
  componentId: string;
  componentLabel: string;
  rows: TrackRow[];
}

interface ChannelGroupProps {
  componentId: string;
  componentLabel: string;
  rows: TrackRow[];
  pixelsPerFrame: number;
  frameOffset: number;
  trackWidth: number;
  selectedKeyframe: SelectedKeyframe | null;
  onKeyframePointerDown: (e: React.PointerEvent<HTMLDivElement>, componentId: string, property: AnimatableProperty, frame: number) => void;
  onLanePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLanePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLanePointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLaneLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
  onOpenChange: (componentId: string, isOpen: boolean) => void;
}

const ChannelGroup = React.memo(({
  componentId,
  componentLabel,
  rows,
  pixelsPerFrame,
  frameOffset,
  trackWidth,
  selectedKeyframe,
  onKeyframePointerDown,
  onLanePointerMove,
  onLanePointerUp,
  onLanePointerCancel,
  onLaneLostPointerCapture,
  onOpenChange,
}: ChannelGroupProps) => {
  const [isOpen, toggle] = useCollapsibleState(`timeline-channel-group:${componentId}`, true);

  React.useEffect(() => {
    onOpenChange(componentId, isOpen);
  }, [componentId, isOpen, onOpenChange]);

  return (
    <div className="dope-sheet-group">
      <div className="dope-sheet-row" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dope-sheet-group-header"
          style={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0 }}
          onClick={toggle}
          aria-expanded={isOpen}
          title={componentLabel}
        >
          <svg
            className={`dope-sheet-group-chevron${isOpen ? ' dope-sheet-group-chevron-open' : ''}`}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <path d="M3 1 L7 5 L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="dope-sheet-group-name">{componentLabel}</span>
        </button>
        <div className="dope-sheet-row-lane" style={{ width: trackWidth }} />
      </div>
      {isOpen && rows.map(row => (
        <DopeSheetRow
          key={`${row.componentId}:${row.property}`}
          row={row}
          pixelsPerFrame={pixelsPerFrame}
          frameOffset={frameOffset}
          trackWidth={trackWidth}
          selectedKeyframe={selectedKeyframe}
          onKeyframePointerDown={onKeyframePointerDown}
          onLanePointerMove={onLanePointerMove}
          onLanePointerUp={onLanePointerUp}
          onLanePointerCancel={onLanePointerCancel}
          onLaneLostPointerCapture={onLaneLostPointerCapture}
        />
      ))}
    </div>
  );
});

ChannelGroup.displayName = 'ChannelGroup';

interface DopeSheetGridProps {
  ticks: RulerTick[];
  pixelsPerFrame: number;
  frameOffset: number;
  height: number;
}

const DopeSheetGrid = React.memo(({ ticks, pixelsPerFrame, frameOffset, height }: DopeSheetGridProps) => {
  return (
    <div className="dope-sheet-grid" style={{ left: LABEL_COLUMN_WIDTH, height }}>
      {ticks.filter(t => t.isMajor).map(t => (
        <div
          key={t.frame}
          className="dope-sheet-grid-line"
          style={{ left: frameToPixels(t.frame + frameOffset, pixelsPerFrame) }}
        />
      ))}
    </div>
  );
});

DopeSheetGrid.displayName = 'DopeSheetGrid';

interface RangeHighlightProps {
  startFrame: number;
  endFrame: number;
  pixelsPerFrame: number;
  padFrames: number;
}

const RangeHighlight = React.memo(({ startFrame, endFrame, pixelsPerFrame, padFrames }: RangeHighlightProps) => {
  return (
    <div
      className="timeline-range-highlight"
      style={{
        left: LABEL_COLUMN_WIDTH + frameToPixels(padFrames, pixelsPerFrame),
        width: frameToPixels(endFrame - startFrame, pixelsPerFrame),
      }}
    />
  );
});

RangeHighlight.displayName = 'RangeHighlight';

const FrameRuler = React.memo(React.forwardRef<HTMLDivElement, {
  ticks: RulerTick[];
  frameOffset: number;
  pixelsPerFrame: number;
  width: number;
}>(({
  ticks,
  frameOffset,
  pixelsPerFrame,
  width,
}, ref) => {
  return (
    <div ref={ref} className="timeline-ruler" style={{ width }}>
      {ticks.map(tick => (
        <div
          key={tick.frame}
          className={`timeline-ruler-tick ${tick.isMajor ? 'timeline-ruler-tick-major' : 'timeline-ruler-tick-minor'}`}
          style={{ left: frameToPixels(tick.frame + frameOffset, pixelsPerFrame) }}
        >
          {tick.isMajor && (
            <span className="timeline-ruler-tick-label">{tick.frame}</span>
          )}
        </div>
      ))}
    </div>
  );
}));

FrameRuler.displayName = 'FrameRuler';

export interface TimelinePanelProps {
  overlay: OverlayConfig;
  currentFrame: number;
  isPlaying: boolean;
  onScrub: (frame: number) => void;
  onPlayPause: (playing: boolean) => void;
  onCommitFps: (fps: number) => void;
  onCommitStartFrame: (startFrame: number) => void;
  onCommitEndFrame: (endFrame: number) => void;
  components: ComponentLabel[];
  selectedComponentIds: string[];
  onRetimeKeyframe: (componentId: string, property: AnimatableProperty, fromFrame: number, toFrame: number) => void;
  onRemoveKeyframe: (componentId: string, property: AnimatableProperty, frame: number) => void;
  onPasteKeyframe: (componentId: string, property: AnimatableProperty, keyframe: Keyframe) => void;
  onSetKeyframeValue: (componentId: string, property: AnimatableProperty, frame: number, value: number) => void;
  onInsertOnCurve: (componentId: string, property: AnimatableProperty, frame: number) => void;
  onSetKeyframeHandle: (componentId: string, property: AnimatableProperty, frame: number, side: 'in' | 'out', handle: Handle) => void;
  onSetKeyframeInterpolation: (componentId: string, property: AnimatableProperty, frame: number, interpolation: Interpolation) => void;
  onSetKeyframeHandleMode: (componentId: string, property: AnimatableProperty, frame: number, handleMode: HandleMode) => void;
  editingShapeId?: string | null;
  panelHeight: number;
  onPanelHeightChange: (height: number) => void;
  minPanelHeight: number;
  maxPanelHeight: number;
}

const TimelinePanel = ({
  overlay,
  currentFrame,
  isPlaying,
  onScrub,
  onPlayPause,
  onCommitFps,
  onCommitStartFrame,
  onCommitEndFrame,
  components,
  selectedComponentIds,
  onRetimeKeyframe,
  onRemoveKeyframe,
  onPasteKeyframe,
  onSetKeyframeValue,
  onInsertOnCurve,
  onSetKeyframeHandle,
  onSetKeyframeInterpolation,
  onSetKeyframeHandleMode,
  editingShapeId,
  panelHeight,
  onPanelHeightChange,
  minPanelHeight,
  maxPanelHeight,
}: TimelinePanelProps) => {
  const [viewMode, setViewMode] = React.useState<'dope' | 'graph'>('dope');
  const [activeChannel, setActiveChannel] = React.useState<ChannelRef | null>(null);
  const [fitSignal, setFitSignal] = React.useState(0);
  const [pixelsPerFrame, setPixelsPerFrame] = React.useState(DEFAULT_PIXELS_PER_FRAME);
  const [selectedKeyframe, setSelectedKeyframe] = React.useState<SelectedKeyframe | null>(null);
  const [copiedKeyframe, setCopiedKeyframe] = React.useState<
    { componentId: string; property: AnimatableProperty; keyframe: Keyframe } | null
  >(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const paneActiveRef = React.useRef(false);
  const laneOriginRef = React.useRef<HTMLDivElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const zoomAnchorRef = React.useRef<{ frame: number; clientOffset: number } | null>(null);
  const panelResizeRef = React.useRef<{ startY: number; startHeight: number } | null>(null);
  const dragRef = React.useRef<{ componentId: string; property: AnimatableProperty; lastFrame: number } | null>(null);
  const { fps, startFrame, endFrame, tracks } = overlay;
  const padFrames = React.useMemo(() => computeOutOfRangePad(endFrame - startFrame), [startFrame, endFrame]);
  const rangeStart = startFrame - padFrames;
  const rangeEnd = endFrame + padFrames;

  const frameFromClientX = React.useCallback((clientX: number) => {
    const origin = laneOriginRef.current;
    if (!origin) return 0;
    const rect = origin.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const rawFrame = offsetX / pixelsPerFrame + rangeStart;
    return Math.min(Math.max(rangeStart, Math.round(rawFrame)), rangeEnd);
  }, [pixelsPerFrame, rangeStart, rangeEnd]);

  const rows: TrackRow[] = React.useMemo(() => {
    if (selectedComponentIds.length === 0) return [];
    const selectedSet = new Set(selectedComponentIds);
    return tracks
      .filter(t => selectedSet.has(t.componentId))
      .map(t => ({
        componentId: t.componentId,
        componentLabel: components.find(c => c.id === t.componentId)?.displayName || t.componentId,
        property: t.property,
        keyframes: t.keyframes,
      }))
      .sort((a, b) => a.componentId === b.componentId
        ? a.property.localeCompare(b.property)
        : a.componentLabel.localeCompare(b.componentLabel));
  }, [tracks, selectedComponentIds, components]);

  React.useEffect(() => {
    if (rows.length === 0) {
      setActiveChannel(null);
      return;
    }
    setActiveChannel(prev => {
      const stillPresent = prev && rows.some(r => r.componentId === prev.componentId && r.property === prev.property);
      if (stillPresent) return prev;
      return { componentId: rows[0].componentId, property: rows[0].property };
    });
  }, [rows]);

  const selectedKf = React.useMemo(() => {
    if (!selectedKeyframe) return null;
    const row = rows.find(r =>
      r.componentId === selectedKeyframe.componentId && r.property === selectedKeyframe.property,
    );
    return row?.keyframes.find(k => k.frame === selectedKeyframe.frame) ?? null;
  }, [rows, selectedKeyframe]);

  React.useEffect(() => {
    setSelectedKeyframe(prev => {
      if (!prev) return prev;
      const stillExists = rows.some(row =>
        row.componentId === prev.componentId &&
        row.property === prev.property &&
        row.keyframes.some(k => k.frame === prev.frame)
      );
      return stillExists ? prev : null;
    });
  }, [rows]);

  const groups: ChannelGroupData[] = React.useMemo(() => {
    const byComponent = new Map<string, ChannelGroupData>();
    for (const row of rows) {
      let group = byComponent.get(row.componentId);
      if (!group) {
        group = { componentId: row.componentId, componentLabel: row.componentLabel, rows: [] };
        byComponent.set(row.componentId, group);
      }
      group.rows.push(row);
    }
    return Array.from(byComponent.values());
  }, [rows]);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  const handleGroupOpenChange = React.useCallback((componentId: string, isOpen: boolean) => {
    setOpenGroups(prev => (prev[componentId] === isOpen ? prev : { ...prev, [componentId]: isOpen }));
  }, []);

  React.useEffect(() => {
    if (selectedKeyframe && openGroups[selectedKeyframe.componentId] === false) {
      setSelectedKeyframe(null);
    }
  }, [selectedKeyframe, openGroups]);

  const handleKeyframePointerDown = React.useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    componentId: string,
    property: AnimatableProperty,
    frame: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.target as HTMLElement).closest('.dope-sheet-row-lane') as HTMLElement | null;
    lane?.setPointerCapture(e.pointerId);
    setSelectedKeyframe({ componentId, property, frame });
    dragRef.current = { componentId, property, lastFrame: frame };
  }, []);

  const handleLanePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.buttons !== 1) return;
    const newFrame = frameFromClientX(e.clientX);
    if (newFrame === drag.lastFrame) return;
    onRetimeKeyframe(drag.componentId, drag.property, drag.lastFrame, newFrame);
    drag.lastFrame = newFrame;
    setSelectedKeyframe({ componentId: drag.componentId, property: drag.property, frame: newFrame });
  }, [frameFromClientX, onRetimeKeyframe]);

  const handleLanePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  const handleLanePointerCancel = React.useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleLaneLostPointerCapture = React.useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleDopeSheetPointerDown = React.useCallback(() => {
    setSelectedKeyframe(null);
  }, []);

  React.useEffect(() => {
    const handleDeleteKeyframe = (e: KeyboardEvent) => {
      if (!selectedKeyframe) return;
      if (editingShapeId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onRemoveKeyframe(selectedKeyframe.componentId, selectedKeyframe.property, selectedKeyframe.frame);
        setSelectedKeyframe(null);
      }
    };
    document.addEventListener('keydown', handleDeleteKeyframe, true);
    return () => document.removeEventListener('keydown', handleDeleteKeyframe, true);
  }, [selectedKeyframe, onRemoveKeyframe, editingShapeId]);

  React.useEffect(() => {
    const handleCopyPaste = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (editingShapeId) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === 'c') {
        if (!selectedKeyframe) return;
        const track = tracks.find(
          t => t.componentId === selectedKeyframe.componentId && t.property === selectedKeyframe.property,
        );
        const source = track?.keyframes.find(k => k.frame === selectedKeyframe.frame);
        if (!source) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setCopiedKeyframe({
          componentId: selectedKeyframe.componentId,
          property: selectedKeyframe.property,
          keyframe: { ...source },
        });
        return;
      }

      if (key === 'v') {
        if (!copiedKeyframe) return;
        if (!paneActiveRef.current) return;
        const targetFrame = clampFrame(currentFrame, rangeStart, rangeEnd);
        e.preventDefault();
        e.stopImmediatePropagation();
        onPasteKeyframe(copiedKeyframe.componentId, copiedKeyframe.property, {
          ...copiedKeyframe.keyframe,
          frame: targetFrame,
        });
        setSelectedKeyframe({
          componentId: copiedKeyframe.componentId,
          property: copiedKeyframe.property,
          frame: targetFrame,
        });
      }
    };
    document.addEventListener('keydown', handleCopyPaste, true);
    return () => document.removeEventListener('keydown', handleCopyPaste, true);
  }, [
    selectedKeyframe,
    copiedKeyframe,
    tracks,
    onPasteKeyframe,
    editingShapeId,
    currentFrame,
    rangeStart,
    rangeEnd,
  ]);

  const keyframeFrames = React.useMemo(
    () => collectKeyframeFrames(tracks, selectedComponentIds),
    [tracks, selectedComponentIds]
  );

  const jumpToStart = React.useCallback(() => {
    onScrub(clampFrame(startFrame, rangeStart, rangeEnd));
  }, [onScrub, startFrame, rangeStart, rangeEnd]);

  const jumpToEnd = React.useCallback(() => {
    onScrub(clampFrame(endFrame, rangeStart, rangeEnd));
  }, [onScrub, endFrame, rangeStart, rangeEnd]);

  const jumpToPreviousKeyframe = React.useCallback(() => {
    const target = findAdjacentKeyframe(keyframeFrames, currentFrame, -1);
    if (target !== null) onScrub(clampFrame(target, rangeStart, rangeEnd));
  }, [keyframeFrames, currentFrame, onScrub, rangeStart, rangeEnd]);

  const jumpToNextKeyframe = React.useCallback(() => {
    const target = findAdjacentKeyframe(keyframeFrames, currentFrame, 1);
    if (target !== null) onScrub(clampFrame(target, rangeStart, rangeEnd));
  }, [keyframeFrames, currentFrame, onScrub, rangeStart, rangeEnd]);

  React.useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      paneActiveRef.current = !!panelRef.current && panelRef.current.contains(e.target as Node);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  React.useEffect(() => {
    const handleFitKey = (e: KeyboardEvent) => {
      if (e.key !== 'Home') return;
      if (isTypingTarget(e.target)) return;
      if (!paneActiveRef.current) return;
      e.preventDefault();
      setFitSignal(n => n + 1);
    };
    document.addEventListener('keydown', handleFitKey, true);
    return () => document.removeEventListener('keydown', handleFitKey, true);
  }, []);

  React.useEffect(() => {
    const handleArrowNav = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTypingTarget(e.target)) return;
      if (editingShapeId) return;
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === 'ArrowLeft' ? -step : step;

      if (selectedKeyframe) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const newFrame = clampFrame(selectedKeyframe.frame + delta, rangeStart, rangeEnd);
        if (newFrame !== selectedKeyframe.frame) {
          onRetimeKeyframe(selectedKeyframe.componentId, selectedKeyframe.property, selectedKeyframe.frame, newFrame);
          setSelectedKeyframe({ componentId: selectedKeyframe.componentId, property: selectedKeyframe.property, frame: newFrame });
        }
        return;
      }

      if (paneActiveRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onScrub(clampFrame(currentFrame + delta, rangeStart, rangeEnd));
        return;
      }
    };
    document.addEventListener('keydown', handleArrowNav, true);
    return () => document.removeEventListener('keydown', handleArrowNav, true);
  }, [selectedKeyframe, editingShapeId, onRetimeKeyframe, onScrub, currentFrame, rangeStart, rangeEnd]);

  const handleScrubPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onScrub(frameFromClientX(e.clientX));
  }, [frameFromClientX, onScrub]);

  const handleScrubPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    onScrub(frameFromClientX(e.clientX));
  }, [frameFromClientX, onScrub]);

  const handleScrubPointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const zoomIn = React.useCallback(() => {
    setPixelsPerFrame(prev => Math.min(MAX_PIXELS_PER_FRAME, prev + ZOOM_STEP));
  }, []);

  const zoomOut = React.useCallback(() => {
    setPixelsPerFrame(prev => Math.max(MIN_PIXELS_PER_FRAME, prev - ZOOM_STEP));
  }, []);

  React.useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const clientOffset = e.clientX - rect.left;
      const contentX = clientOffset + container.scrollLeft;
      setPixelsPerFrame(prev => {
        const frame = (contentX - LABEL_COLUMN_WIDTH) / prev + rangeStart;
        const direction = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(MAX_PIXELS_PER_FRAME, Math.max(MIN_PIXELS_PER_FRAME, prev + direction * ZOOM_STEP));
        if (next !== prev) {
          zoomAnchorRef.current = { frame, clientOffset };
        }
        return next;
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [rangeStart]);

  React.useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = scrollAreaRef.current;
    if (!anchor || !container) return;
    const newContentX = LABEL_COLUMN_WIDTH + (anchor.frame - rangeStart) * pixelsPerFrame;
    container.scrollLeft = newContentX - anchor.clientOffset;
    zoomAnchorRef.current = null;
  }, [pixelsPerFrame, rangeStart]);

  const handlePanelResizePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panelResizeRef.current = { startY: e.clientY, startHeight: panelHeight };
  }, [panelHeight]);

  const handlePanelResizePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panelResizeRef.current;
    if (!drag) return;
    const deltaY = e.clientY - drag.startY;
    const newHeight = Math.min(maxPanelHeight, Math.max(minPanelHeight, drag.startHeight - deltaY));
    onPanelHeightChange(newHeight);
  }, [minPanelHeight, maxPanelHeight, onPanelHeightChange]);

  const endPanelResize = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    panelResizeRef.current = null;
  }, []);

  const frameOffset = padFrames - startFrame;
  const playheadLeft = LABEL_COLUMN_WIDTH + frameToPixels(currentFrame + frameOffset, pixelsPerFrame);
  const trackWidth = frameToPixels((endFrame - startFrame) + 2 * padFrames, pixelsPerFrame);
  const { ticks } = React.useMemo(
    () => computeTicks(rangeStart, rangeEnd, pixelsPerFrame),
    [rangeStart, rangeEnd, pixelsPerFrame]
  );
  const graphHeight = Math.max(120, panelHeight - 150);
  const dopeSheetHeight = groups.reduce(
    (sum, group) => sum + 28 + (openGroups[group.componentId] === false ? 0 : group.rows.length * 28),
    0
  );

  return (
    <div ref={panelRef} className="timeline-panel" role="region" aria-label="Animation timeline" style={{ height: panelHeight }}>
      <div
        className="timeline-resize-handle"
        onPointerDown={handlePanelResizePointerDown}
        onPointerMove={handlePanelResizePointerMove}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
        onLostPointerCapture={endPanelResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize animation timeline panel"
      />
      <div className="timeline-panel-header">
        <div className="timeline-transport-controls" role="group" aria-label="Timeline transport">
          <button
            type="button"
            className="header-btn header-btn-secondary"
            onClick={jumpToStart}
            aria-label="Jump to start"
          >
            |◀
          </button>
          <button
            type="button"
            className="header-btn header-btn-secondary"
            onClick={jumpToPreviousKeyframe}
            aria-label="Jump to previous keyframe"
          >
            ◀◆
          </button>
          <button
            type="button"
            className="header-btn header-btn-secondary timeline-play-btn"
            onClick={() => onPlayPause(!isPlaying)}
            aria-label={isPlaying ? 'Pause playback' : 'Play animation'}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="header-btn header-btn-secondary"
            onClick={jumpToNextKeyframe}
            aria-label="Jump to next keyframe"
          >
            ◆▶
          </button>
          <button
            type="button"
            className="header-btn header-btn-secondary"
            onClick={jumpToEnd}
            aria-label="Jump to end"
          >
            ▶|
          </button>
        </div>
        <span className="timeline-frame-readout" aria-label="Current frame">
          {Math.round(currentFrame)} / {startFrame}-{endFrame}
        </span>
        <div className="timeline-field">
          <label htmlFor="timeline-fps-input">FPS</label>
          <DebouncedNumberInput
            value={fps}
            min={MIN_FPS}
            max={MAX_FPS}
            onCommit={onCommitFps}
            className="timeline-number-input"
            aria-label="Frames per second"
          />
        </div>
        <div className="timeline-field">
          <label htmlFor="timeline-start-input">Start</label>
          <DebouncedNumberInput
            value={startFrame}
            max={endFrame}
            onCommit={onCommitStartFrame}
            className="timeline-number-input"
            aria-label="Start frame"
          />
        </div>
        <div className="timeline-field">
          <label htmlFor="timeline-end-input">End</label>
          <DebouncedNumberInput
            value={endFrame}
            min={startFrame}
            onCommit={onCommitEndFrame}
            className="timeline-number-input"
            aria-label="End frame"
          />
        </div>
        <div className="timeline-keyframe-inspector" role="group" aria-label="Active keyframe">
          {selectedKf && selectedKeyframe ? (
            <>
              <span className="tki-title" style={{ color: channelColor(selectedKeyframe.property) }}>
                {selectedKeyframe.property}
              </span>
              <label className="tki-field">
                <span>Frame</span>
                <DebouncedNumberInput
                  value={selectedKeyframe.frame}
                  min={rangeStart}
                  max={rangeEnd}
                  onCommit={(next) => {
                    const target = clampFrame(Math.round(next), rangeStart, rangeEnd);
                    if (target === selectedKeyframe.frame) return;
                    onRetimeKeyframe(selectedKeyframe.componentId, selectedKeyframe.property, selectedKeyframe.frame, target);
                    setSelectedKeyframe({ ...selectedKeyframe, frame: target });
                  }}
                  aria-label="Selected keyframe frame"
                />
              </label>
              {typeof selectedKf.value === 'number' && (
                <label className="tki-field">
                  <span>Value</span>
                  <DebouncedNumberInput
                    value={selectedKf.value}
                    onCommit={(next) => onSetKeyframeValue(
                      selectedKeyframe.componentId,
                      selectedKeyframe.property,
                      selectedKeyframe.frame,
                      next,
                    )}
                    aria-label="Selected keyframe value"
                  />
                </label>
              )}
              <label className="tki-field">
                <span>Easing</span>
                <select
                  value={selectedKf.interpolation}
                  onChange={(e) => onSetKeyframeInterpolation(
                    selectedKeyframe.componentId,
                    selectedKeyframe.property,
                    selectedKeyframe.frame,
                    e.target.value as Interpolation,
                  )}
                  aria-label="Keyframe interpolation"
                >
                  <option value="linear">Linear</option>
                  <option value="bezier">Bezier</option>
                  <option value="constant">Constant</option>
                </select>
              </label>
              {selectedKf.interpolation === 'bezier' && (
                <label className="tki-field">
                  <span>Handles</span>
                  <select
                    value={selectedKf.handleMode ?? 'aligned'}
                    onChange={(e) => onSetKeyframeHandleMode(
                      selectedKeyframe.componentId,
                      selectedKeyframe.property,
                      selectedKeyframe.frame,
                      e.target.value as HandleMode,
                    )}
                    aria-label="Keyframe handle mode"
                  >
                    <option value="aligned">Aligned</option>
                    <option value="vector">Vector</option>
                    <option value="free">Free</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              )}
            </>
          ) : (
            <span className="tki-empty">Click a keyframe to edit its easing</span>
          )}
        </div>
        {viewMode === 'graph' && (
          <button
            type="button"
            className="header-btn header-btn-secondary"
            onClick={() => setFitSignal(n => n + 1)}
            aria-label="Fit curves to view"
            title="Fit the value axis to the active channel (or press Home)"
          >
            Fit
          </button>
        )}
        <div className="timeline-view-toggle" role="group" aria-label="Timeline view">
          <button
            type="button"
            className={`header-btn ${viewMode === 'dope' ? 'header-btn-accent' : 'header-btn-secondary'}`}
            onClick={() => setViewMode('dope')}
            aria-pressed={viewMode === 'dope'}
          >
            Dope Sheet
          </button>
          <button
            type="button"
            className={`header-btn ${viewMode === 'graph' ? 'header-btn-accent' : 'header-btn-secondary'}`}
            onClick={() => setViewMode('graph')}
            aria-pressed={viewMode === 'graph'}
          >
            Graph
          </button>
        </div>
        <div className="timeline-zoom-controls" role="group" aria-label="Timeline zoom">
          <button type="button" className="header-btn header-btn-secondary" onClick={zoomOut} aria-label="Zoom out timeline">-</button>
          <button type="button" className="header-btn header-btn-secondary" onClick={zoomIn} aria-label="Zoom in timeline">+</button>
        </div>
      </div>
      <div className="timeline-scroll-area" ref={scrollAreaRef}>
        <div
          className="timeline-scrub-surface"
          style={{ width: LABEL_COLUMN_WIDTH + trackWidth }}
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
        >
          <RangeHighlight
            startFrame={startFrame}
            endFrame={endFrame}
            pixelsPerFrame={pixelsPerFrame}
            padFrames={padFrames}
          />
          <div className="timeline-ruler-row">
            <div className="timeline-ruler-gutter" style={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0 }} />
            <FrameRuler ref={laneOriginRef} ticks={ticks} frameOffset={frameOffset} pixelsPerFrame={pixelsPerFrame} width={trackWidth} />
          </div>
          {viewMode === 'graph' && (
            <div className="graph-editor-wrap">
              <div className="graph-channel-list" style={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0 }}>
                {rows.length === 0 ? (
                  <div className="graph-editor-hint">
                    Select a component with keyframes to see its curves.
                  </div>
                ) : (
                  groups.map(group => (
                    <div key={group.componentId} className="graph-channel-group">
                      <div className="graph-channel-group-label" title={group.componentLabel}>
                        {group.componentLabel}
                      </div>
                      {group.rows.map(row => {
                        const isActive = !!activeChannel
                          && activeChannel.componentId === row.componentId
                          && activeChannel.property === row.property;
                        return (
                          <button
                            key={row.property}
                            type="button"
                            className={`graph-channel${isActive ? ' active' : ''}`}
                            onClick={() => setActiveChannel({ componentId: row.componentId, property: row.property })}
                            aria-pressed={isActive}
                          >
                            <span className="graph-channel-swatch" style={{ background: channelColor(row.property) }} />
                            {row.property}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <GraphEditor
                rows={rows}
                activeChannel={activeChannel}
                onActivateChannel={setActiveChannel}
                width={trackWidth}
                height={graphHeight}
                pixelsPerFrame={pixelsPerFrame}
                originFrame={rangeStart}
                currentFrame={currentFrame}
                selectedKeyframe={selectedKeyframe}
                onSelectKeyframe={setSelectedKeyframe}
                onRetimeKeyframe={onRetimeKeyframe}
                onSetKeyframeValue={onSetKeyframeValue}
                onInsertOnCurve={onInsertOnCurve}
                onSetKeyframeHandle={onSetKeyframeHandle}
                clampFrame={(frame) => clampFrame(frame, rangeStart, rangeEnd)}
                fitSignal={fitSignal}
              />
            </div>
          )}
          {viewMode === 'dope' && groups.length > 0 && (
            <div className="dope-sheet" onPointerDown={handleDopeSheetPointerDown}>
              <DopeSheetGrid ticks={ticks} pixelsPerFrame={pixelsPerFrame} frameOffset={frameOffset} height={dopeSheetHeight} />
              {groups.map(group => (
                <ChannelGroup
                  key={group.componentId}
                  componentId={group.componentId}
                  componentLabel={group.componentLabel}
                  rows={group.rows}
                  pixelsPerFrame={pixelsPerFrame}
                  frameOffset={frameOffset}
                  trackWidth={trackWidth}
                  selectedKeyframe={selectedKeyframe}
                  onKeyframePointerDown={handleKeyframePointerDown}
                  onLanePointerMove={handleLanePointerMove}
                  onLanePointerUp={handleLanePointerUp}
                  onLanePointerCancel={handleLanePointerCancel}
                  onLaneLostPointerCapture={handleLaneLostPointerCapture}
                  onOpenChange={handleGroupOpenChange}
                />
              ))}
            </div>
          )}
          <div
            className="timeline-playhead"
            style={{ left: playheadLeft }}
            role="slider"
            aria-label="Playhead"
            aria-valuemin={startFrame}
            aria-valuemax={endFrame}
            aria-valuenow={Math.round(currentFrame)}
          >
            <span className="timeline-playhead-pill">{Math.round(currentFrame)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelinePanel;
