import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ComponentConfig, LayoutConfig, LAYOUT_TYPES } from './types';
import { resolveActiveStateId } from './shared/conditions';
import type { OverlayConfig, AnimationTrack, AnimatableProperty, Easing } from './shared/utils/overlayTimeline';
import type { DocumentSnapshot, HistoryEntry } from './utils/documentHistory';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import { collectWithDescendants } from './utils/componentSelection';
import { isTextEntryTarget, matchesRedoShortcut, matchesUndoShortcut } from './utils/undoShortcut';
import { pruneTracksForComponent, remapTracksForComponents, setSwitchFrame, retimeKeyframe, removeKeyframe, insertKeyframe, setKeyframeValue, setKeyframeHandle, setKeyframeInterpolationMode, setKeyframeHandleMode, setKeyframeEasingSpec, insertKeyframeOnCurve, type Handle, type HandleMode, type Interpolation, type Keyframe } from './shared/utils/overlayTimeline';
import { saveOverlay, OVERLAY_STORAGE_KEY } from './utils/overlayStorage';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import LayerPanel from './components/LayerPanel';
import ExportModal from './components/ExportModal';
import OverlayExportModal from './components/OverlayExportModal';
import PresetModal from './components/PresetModal';
import OverlayLibraryModal from './components/OverlayLibraryModal';
import TimelinePanel from './components/TimelinePanel';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { ToastProvider, useToast } from './components/Toast';
import { repairTemplateReferences } from './utils/slotTemplates';
import { SHAPE_PRESETS } from './utils/shapePresets';
import { DirtyChannel } from './shared/utils/overlayPreview';
import './App.css';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_LEFT_PANEL_WIDTH = 250;
const DEFAULT_RIGHT_PANEL_WIDTH = 320;

const TIMELINE_PANEL_HEIGHT_KEY = 'timeline-panel-height';
const MIN_TIMELINE_PANEL_HEIGHT = 120;
const MAX_TIMELINE_PANEL_HEIGHT = 640;
const DEFAULT_TIMELINE_PANEL_HEIGHT = 180;

const DEVICE_PRESETS = {
  '1080p TV (1920x1080)': { width: 1920, height: 1080 },
  '4K TV (3840x2160)': { width: 1920, height: 1080 },
  'HD TV (1280x720)': { width: 1280, height: 720 },
  'Custom 16:9': { width: 1600, height: 900 }
} as const;

const DEFAULT_DIMENSIONS = DEVICE_PRESETS['1080p TV (1920x1080)'];

type ClipboardContents = {
  components: ComponentConfig[];
  tracks: AnimationTrack[];
};

function changedDirtyChannelsForUpdate(
  prevComponent: ComponentConfig,
  updates: Partial<ComponentConfig>,
): DirtyChannel[] {
  const changed: DirtyChannel[] = [];
  if (updates.position) {
    if (updates.position.x !== prevComponent.position.x) changed.push('x');
    if (updates.position.y !== prevComponent.position.y) changed.push('y');
  }
  if (updates.size) {
    if (updates.size.width !== prevComponent.size.width) changed.push('width');
    if (updates.size.height !== prevComponent.size.height) changed.push('height');
  }
  if (updates.transform) {
    const prevRotation = prevComponent.transform?.rotation ?? 0;
    const prevScale = prevComponent.transform?.scale ?? 1;
    const nextRotation = updates.transform.rotation ?? 0;
    const nextScale = updates.transform.scale ?? 1;
    if (nextRotation !== prevRotation) changed.push('rotation');
    if (nextScale !== prevScale) changed.push('scale');
  }
  return changed;
}

function trackChannelKey(componentId: string, property: AnimatableProperty): string {
  return `${componentId}:${property}`;
}

function findWrittenChannels(
  prevTracks: AnimationTrack[],
  nextTracks: AnimationTrack[],
): Array<{ componentId: string; property: AnimatableProperty }> {
  const prevByKey = new Map(prevTracks.map(t => [trackChannelKey(t.componentId, t.property), t]));
  const written: Array<{ componentId: string; property: AnimatableProperty }> = [];
  for (const track of nextTracks) {
    const key = trackChannelKey(track.componentId, track.property);
    const prevTrack = prevByKey.get(key);
    if (!prevTrack || JSON.stringify(prevTrack.keyframes) !== JSON.stringify(track.keyframes)) {
      written.push({ componentId: track.componentId, property: track.property });
    }
  }
  return written;
}

function isDirtyEligibleProperty(property: AnimatableProperty): property is DirtyChannel {
  return property === 'x' || property === 'y' || property === 'width' || property === 'height'
    || property === 'rotation' || property === 'scale';
}

const MemoizedCanvas = React.memo(Canvas);
const MemoizedLayerPanel = React.memo(LayerPanel);
const MemoizedPropertyPanel = React.memo(PropertyPanel);
const MemoizedExportModal = React.memo(ExportModal);
const MemoizedOverlayExportModal = React.memo(OverlayExportModal);
const MemoizedPresetModal = React.memo(PresetModal);
const MemoizedOverlayLibraryModal = React.memo(OverlayLibraryModal);
const MemoizedTimelinePanel = React.memo(TimelinePanel);
const MemoizedKeyboardShortcutsModal = React.memo(KeyboardShortcutsModal);

const Fake404Overlay = ({ onDismiss }: { onDismiss: () => void }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fake-404-overlay">
      <div className="fake-404-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="https://github.com" className="fake-404-link">Go to GitHub</a>
      </div>
    </div>
  );
};

function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('layout-builder-unlocked') === 'true';
  });

  const handleUnlock = useCallback(() => {
    setIsUnlocked(true);
    sessionStorage.setItem('layout-builder-unlocked', 'true');
  }, []);

  const [layout, setLayout] = useState<LayoutConfig>({
    name: 'basketball',
    components: [],
    backgroundColor: '#000000',
    dimensions: DEFAULT_DIMENSIONS
  });

  const [documentKind, setDocumentKind] = useState<'layout' | 'overlay'>('layout');
  const [overlay, setOverlay] = useState<OverlayConfig | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dirtyChannels, setDirtyChannels] = useState<Map<string, Set<DirtyChannel>>>(new Map());

  useEffect(() => {
    setDirtyChannels(new Map());
  }, [currentFrame]);

  const markChannelsDirty = useCallback((componentId: string, channels: DirtyChannel[]) => {
    if (channels.length === 0) return;
    setDirtyChannels(prev => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      const set = existing ? new Set(existing) : new Set<DirtyChannel>();
      for (const channel of channels) set.add(channel);
      next.set(componentId, set);
      return next;
    });
  }, []);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTimeRef = useRef<number | null>(null);

  const overlayAsLayoutView = useCallback((o: OverlayConfig): LayoutConfig => ({
    name: o.name,
    components: o.components as ComponentConfig[],
    backgroundColor: o.backgroundColor,
    dimensions: o.dimensions,
  }), []);

  const activeDocument: LayoutConfig = useMemo(() => {
    if (documentKind === 'overlay' && overlay) {
      return {
        name: overlay.name,
        components: overlay.components as ComponentConfig[],
        backgroundColor: overlay.backgroundColor,
        dimensions: overlay.dimensions,
      };
    }
    return layout;
  }, [documentKind, layout, overlay?.name, overlay?.components, overlay?.backgroundColor, overlay?.dimensions]);

  const setActiveDocument = useCallback((updater: (prev: LayoutConfig) => LayoutConfig) => {
    if (documentKind === 'overlay') {
      setOverlay(prevOverlay => {
        if (!prevOverlay) return prevOverlay;
        const nextView = updater(overlayAsLayoutView(prevOverlay));
        return {
          ...prevOverlay,
          name: nextView.name,
          components: nextView.components,
          backgroundColor: nextView.backgroundColor,
          dimensions: nextView.dimensions,
        };
      });
    } else {
      setLayout(updater);
    }
  }, [documentKind, overlayAsLayoutView]);

  const [gameData, setGameData] = useState({
    homeTeam: {
      name: 'HOME',
      score: 1,
      fouls: 4,
      timeouts: 3,
      bonus: true,
      doubleBonus: false,
      possession: false,
      color: '#c41e3a',
      hits: 0,
      errors: 0,
      cornerKicks: 0
    },
    awayTeam: {
      name: 'AWAY',
      score: 0,
      fouls: 6,
      timeouts: 2,
      bonus: false,
      doubleBonus: true,
      possession: true,
      color: '#003f7f',
      hits: 0,
      errors: 0,
      cornerKicks: 0
    },
    gameClock: '5:42',
    activityClock: '1:30',
    timeoutClock: '0:30',
    timeOfDay: '2:45 PM',
    timerName: 'Timer Name',
    sessionName: 'Session Name',
    nextUp: 'Next Up',
    period: '4',
    shotClock: 14,
    quarter: 4,
    half: 2,
    set: 3,
    isOvertimeActive: true,
    down: 1,
    yardsToGo: 10,
    ballOn: 35,
    balls: 0,
    strikes: 0,
    outs: 0,
    firstBase: false,
    secondBase: false,
    thirdBase: false,
    onBase: '000',
    gamePeriodScores: [
      { period: 1, homeScore: 0, awayScore: 0 },
      { period: 2, homeScore: 0, awayScore: 0 },
      { period: 3, homeScore: 0, awayScore: 0 },
      { period: 4, homeScore: 0, awayScore: 0 },
      { period: 5, homeScore: 0, awayScore: 0 },
      { period: 6, homeScore: 0, awayScore: 0 },
      { period: 7, homeScore: 0, awayScore: 0 },
      { period: 8, homeScore: 0, awayScore: 0 },
      { period: 9, homeScore: 0, awayScore: 0 },
    ],
    inningSlots: [
      { period: 1, homeScore: 0, awayScore: 0, isCurrentInning: true, isTopHalf: true },
      { period: 2, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 3, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 4, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 5, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 6, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 7, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 8, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
      { period: 9, homeScore: 0, awayScore: 0, isCurrentInning: false, isTopHalf: false },
    ],
    inningDisplayCount: 9,
    home_sets_won: 0,
    away_sets_won: 0,
    home_player_points: 0,
    away_player_points: 0,
    home_player_name: 'Green',
    away_player_name: 'Red',
    home_team_color: '#c41e3a',
    away_team_color: '#003f7f',
    home_shots: 0,
    away_shots: 0,
    home_saves: 0,
    away_saves: 0,
    home_tries: 0,
    away_tries: 0,
    home_penalty_goals: 0,
    away_penalty_goals: 0,
    home_dropped_goals: 0,
    away_dropped_goals: 0,
    home_conversions: 0,
    away_conversions: 0,
    penaltySlots: {
      home: {
        count: 0,
        isState0: true,
        isState1: false,
        isState2: false,
        isState3: false,
        slot0: { jersey: 90, time: '0:45', active: false },
        slot1: { jersey: 3, time: '1:30', active: false },
        slot2: { jersey: 17, time: '2:15', active: false },
      },
      away: {
        count: 0,
        isState0: true,
        isState1: false,
        isState2: false,
        isState3: false,
        slot0: { jersey: 14, time: '1:00', active: false },
        slot1: { jersey: 22, time: '1:45', active: false },
        slot2: { jersey: 8, time: '2:30', active: false },
      },
    },
    home_shootout_made: 0,
    away_shootout_made: 0,
    shootoutSlots: [
      { round: 1, homeActive: false, awayActive: false, homeState: 0, awayState: 0, isCurrentRound: false },
      { round: 2, homeActive: false, awayActive: false, homeState: 0, awayState: 0, isCurrentRound: false },
      { round: 3, homeActive: false, awayActive: false, homeState: 0, awayState: 0, isCurrentRound: false },
      { round: 4, homeActive: false, awayActive: false, homeState: 0, awayState: 0, isCurrentRound: false },
      { round: 5, homeActive: false, awayActive: false, homeState: 0, awayState: 0, isCurrentRound: false },
    ],
    trivia: {
      phase: 'question',
      questionKind: 'multiple_choice',
      multiSelect: false,
      wager: false,
      gameName: 'Basketball Trivia',
      roomCode: 'WX2DRP',
      joinUrl: 'https://example.com/engage/j/WX2DRP',
      questionNumber: 3,
      questionTotal: 10,
      questionText: 'Which of these is NOT a violation in basketball?',
      points: 100,
      answerText: 'Icing',
      playerCount: 42,
      answeredCount: 37,
      secondsRemaining: 12,
    },
    triviaSlots: {
      optionCount: 4,
      home: {
        slot0: { exists: true, label: 'A', text: 'Traveling', correct: false },
        slot1: { exists: true, label: 'B', text: 'Double dribble', correct: false },
        slot2: { exists: true, label: 'C', text: 'Icing', correct: true },
        slot3: { exists: true, label: 'D', text: 'Backcourt', correct: false },
      },
    },
    leaderboardSlots: {
      home: {
        count: 6,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: false,
        isState6: true,
        slot0: { jersey: '23', name: 'M. Jordan', points: 30, fouls: 2, isTopScorer: true, active: true, aces: 5, kills: 18, blocks: 2 },
        slot1: { jersey: '33', name: 'S. Pippen', points: 22, fouls: 3, isTopScorer: false, active: true, aces: 3, kills: 12, blocks: 4 },
        slot2: { jersey: '91', name: 'D. Rodman', points: 8, fouls: 4, isTopScorer: false, active: true, aces: 2, kills: 8, blocks: 6 },
        slot3: { jersey: '7', name: 'T. Kukoc', points: 12, fouls: 1, isTopScorer: false, active: true, aces: 4, kills: 6, blocks: 1 },
        slot4: { jersey: '25', name: 'S. Kerr', points: 6, fouls: 0, isTopScorer: false, active: true, aces: 1, kills: 10, blocks: 3 },
        slot5: { jersey: '10', name: 'B. Harper', points: 4, fouls: 1, isTopScorer: false, active: true, aces: 2, kills: 5, blocks: 2 },
      },
      away: {
        count: 6,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: false,
        isState6: true,
        slot0: { jersey: '32', name: 'K. Malone', points: 28, fouls: 3, isTopScorer: true, active: true, aces: 4, kills: 15, blocks: 3 },
        slot1: { jersey: '12', name: 'J. Stockton', points: 18, fouls: 2, isTopScorer: false, active: true, aces: 2, kills: 14, blocks: 5 },
        slot2: { jersey: '4', name: 'J. Hornacek', points: 14, fouls: 1, isTopScorer: false, active: true, aces: 6, kills: 7, blocks: 2 },
        slot3: { jersey: '53', name: 'M. Eaton', points: 4, fouls: 4, isTopScorer: false, active: true, aces: 1, kills: 9, blocks: 4 },
        slot4: { jersey: '35', name: 'A. Carr', points: 10, fouls: 2, isTopScorer: false, active: true, aces: 3, kills: 11, blocks: 1 },
        slot5: { jersey: '24', name: 'T. Bailey', points: 2, fouls: 0, isTopScorer: false, active: true, aces: 1, kills: 6, blocks: 3 },
      },
    },
    volleyballLeaderboardSlots: {
      home: {
        count: 5,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: true,
        slot0: { jersey: '10', name: 'K. Plummer', aces: 5, kills: 18, blocks: 2, active: true },
        slot1: { jersey: '2', name: 'M. Ratterman', aces: 3, kills: 12, blocks: 4, active: true },
        slot2: { jersey: '15', name: 'T. Shoji', aces: 2, kills: 8, blocks: 6, active: true },
        slot3: { jersey: '8', name: 'J. Smith', aces: 4, kills: 6, blocks: 1, active: true },
        slot4: { jersey: '22', name: 'R. Chen', aces: 1, kills: 10, blocks: 3, active: true },
      },
      away: {
        count: 5,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: true,
        slot0: { jersey: '7', name: 'A. Johnson', aces: 4, kills: 15, blocks: 3, active: true },
        slot1: { jersey: '11', name: 'S. Williams', aces: 2, kills: 14, blocks: 5, active: true },
        slot2: { jersey: '3', name: 'D. Garcia', aces: 6, kills: 7, blocks: 2, active: true },
        slot3: { jersey: '19', name: 'M. Lee', aces: 1, kills: 9, blocks: 4, active: true },
        slot4: { jersey: '5', name: 'C. Brown', aces: 3, kills: 11, blocks: 1, active: true },
      },
    },
    currentPlayer: {
      home: { jersey: '23', name: 'M. Jordan', points: 30, fouls: 2, isTopScorer: true, imageUrl: '/images/test_leaderboard/player_home_1.png', aces: 5, kills: 18, blocks: 2 },
      away: { jersey: '32', name: 'K. Malone', points: 28, fouls: 3, isTopScorer: true, imageUrl: '/images/test_leaderboard/player_away_1.png', aces: 4, kills: 15, blocks: 3 },
    }
  });

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [selectedVertices, setSelectedVertices] = useState<number[]>([]);

  useEffect(() => {
    if (editingShapeId && !(activeDocument.components || []).some(c => c.id === editingShapeId && c.type === 'shape')) {
      setEditingShapeId(null);
      setSelectedVertices([]);
    }
  }, [editingShapeId, activeDocument.components]);

  const getAllDescendants = useCallback((parentId: string, components: ComponentConfig[]): string[] => {
    const children = components.filter(c => c.parentId === parentId);
    const descendants: string[] = [];
    for (const child of children) {
      descendants.push(child.id);
      descendants.push(...getAllDescendants(child.id, components));
    }
    return descendants;
  }, []);

  const handleSelectComponents = useCallback((ids: string[], options?: { autoPinState?: boolean }) => {
    const autoPinState = options?.autoPinState !== false;
    const components = activeDocument.components || [];

    const expandedIds = new Set<string>(ids);
    for (const id of ids) {
      const component = components.find(c => c.id === id);
      if (component?.type === 'group') {
        const parent = component.parentId ? components.find(c => c.id === component.parentId) : undefined;
        const isStateContainer = parent?.type === 'multiState' &&
          Array.isArray(parent.props?.states) &&
          parent.props.states.some((s: any) => s.childId === component.id);
        if (isStateContainer) continue;
        const descendants = getAllDescendants(id, components);
        descendants.forEach(d => expandedIds.add(d));
      }
    }

    const pinUpdates = new Map<string, string>();
    for (const id of autoPinState ? ids : []) {
      let node = components.find(c => c.id === id);
      while (node?.parentId) {
        const parent = components.find(c => c.id === node!.parentId);
        if (!parent) break;
        if (parent.type === 'multiState' && Array.isArray(parent.props?.states)) {
          const entry = parent.props.states.find((s: any) => s.childId === node!.id);
          if (entry && parent.props.previewStateId !== entry.id) {
            pinUpdates.set(parent.id, entry.id);
          }
          break;
        }
        node = parent;
      }
    }
    if (pinUpdates.size > 0) {
      setActiveDocument(prev => ({
        ...prev,
        components: (prev.components || []).map(c =>
          pinUpdates.has(c.id)
            ? { ...c, props: { ...c.props, previewStateId: pinUpdates.get(c.id) } }
            : c
        ),
      }));
    }

    setSelectedComponents(Array.from(expandedIds));
  }, [activeDocument.components, getAllDescendants, setActiveDocument]);

  const handleSelectFromCanvas = useCallback((ids: string[]) => {
    handleSelectComponents(ids, { autoPinState: false });
  }, [handleSelectComponents]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showOverlayExportModal, setShowOverlayExportModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showOverlayLibrary, setShowOverlayLibrary] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  const [draggedComponent, setDraggedComponent] = useState<ComponentConfig | null>(null);

  const [clipboard, setClipboard] = useState<ClipboardContents | null>(null);

  const toast = useToast();
  
  
  

  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const [timelinePanelHeight, setTimelinePanelHeight] = useState<number>(() => {
    const stored = localStorage.getItem(TIMELINE_PANEL_HEIGHT_KEY);
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed)
      ? Math.min(MAX_TIMELINE_PANEL_HEIGHT, Math.max(MIN_TIMELINE_PANEL_HEIGHT, parsed))
      : DEFAULT_TIMELINE_PANEL_HEIGHT;
  });

  useEffect(() => {
    localStorage.setItem(TIMELINE_PANEL_HEIGHT_KEY, String(timelinePanelHeight));
  }, [timelinePanelHeight]);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = leftPanelWidth;
  }, [leftPanelWidth]);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = rightPanelWidth;
  }, [rightPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + delta));
        setLeftPanelWidth(newWidth);
      } else if (isResizingRight) {
        const delta = resizeStartX.current - e.clientX;
        const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + delta));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);

  const generateComponentId = useCallback((type: ComponentConfig['type']) => {
    const uuid = crypto.randomUUID();
    return `${type}_${uuid}`;
  }, []);

  const documentKindRef = useRef(documentKind);
  documentKindRef.current = documentKind;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const selectionRef = useRef(selectedComponents);
  selectionRef.current = selectedComponents;

  const getHistorySnapshot = useCallback((): DocumentSnapshot => {
    if (documentKindRef.current === 'overlay' && overlayRef.current) {
      return { kind: 'overlay', document: structuredClone(overlayRef.current) };
    }
    return { kind: 'layout', document: structuredClone(layoutRef.current) };
  }, []);

  const getHistorySelection = useCallback(() => selectionRef.current, []);

  const currentComponents = useCallback((): ComponentConfig[] => {
    if (documentKindRef.current === 'overlay' && overlayRef.current) {
      return (overlayRef.current.components as ComponentConfig[]) || [];
    }
    return layoutRef.current.components || [];
  }, []);

  const restoreHistoryEntry = useCallback((entry: HistoryEntry) => {
    const { snapshot } = entry;
    if (snapshot.kind !== documentKindRef.current) return;

    if (snapshot.kind === 'overlay') {
      setOverlay(structuredClone(snapshot.document));
    } else {
      setLayout(structuredClone(snapshot.document));
    }
    setSelectedComponents(entry.selection);
    setDirtyChannels(new Map());
  }, []);

  const history = useDocumentHistory({
    getSnapshot: getHistorySnapshot,
    getSelection: getHistorySelection,
    onRestore: restoreHistoryEntry,
  });

  const {
    capture: captureHistory,
    captureCoalesced: captureHistoryCoalesced,
    begin: beginHistoryTransaction,
    commit: commitHistoryTransaction,
    undo,
    redo,
    reset: resetHistory,
  } = history;

  const quickSavePreset = useCallback(() => {
    const PRESETS_STORAGE_KEY = 'scoreboard-layout-presets';
    const nameToUse = layout.name || 'Untitled Layout';
    
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    const savedPresets = saved ? JSON.parse(saved) : [];
    
    const newPreset = {
      id: `preset_${Date.now()}`,
      name: nameToUse,
      layout: { ...layout },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingIndex = savedPresets.findIndex((p: any) => p.name === newPreset.name);
    let updatedPresets;

    if (existingIndex >= 0) {
      updatedPresets = [...savedPresets];
      updatedPresets[existingIndex] = { 
        ...newPreset, 
        id: savedPresets[existingIndex].id, 
        createdAt: savedPresets[existingIndex].createdAt 
      };
    } else {
      updatedPresets = [...savedPresets, newPreset];
    }

    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));

    const action = existingIndex >= 0 ? 'updated' : 'saved';
    toast.success(`Preset "${nameToUse}" ${action} successfully!`);
  }, [layout, toast]);

  const LAYOUT_AUTOSAVE_KEY = 'scoreboard-layout-autosave';
  const OVERLAY_AUTOSAVE_KEY = 'sv-overlay-autosave';

  const switchToLayout = useCallback(() => {
    if (documentKind === 'layout') return;
    if (overlay) {
      localStorage.setItem(OVERLAY_AUTOSAVE_KEY, JSON.stringify(overlay));
    }
    const autosaved = localStorage.getItem(LAYOUT_AUTOSAVE_KEY);
    if (autosaved) {
      try {
        setLayout(JSON.parse(autosaved));
      } catch {}
    }
    setDocumentKind('layout');
    setSelectedComponents([]);
    resetHistory();
    setIsPlaying(false);
    setCurrentFrame(0);
  }, [documentKind, overlay, resetHistory]);

  const saveCurrentOverlay = useCallback(() => {
    if (!overlay) return;
    saveOverlay(overlay, new Date().toISOString());
    toast.success(`Overlay "${overlay.name}" saved`);
  }, [overlay, toast]);

  const loadOverlayFromLibrary = useCallback((loaded: OverlayConfig) => {
    if (documentKind === 'layout') {
      localStorage.setItem(LAYOUT_AUTOSAVE_KEY, JSON.stringify(layout));
    } else if (overlay) {
      localStorage.setItem(OVERLAY_AUTOSAVE_KEY, JSON.stringify(overlay));
    }
    let next = loaded;
    const autosaved = localStorage.getItem(OVERLAY_AUTOSAVE_KEY);
    if (autosaved) {
      try {
        const parsed = JSON.parse(autosaved) as OverlayConfig;
        if (parsed.id === loaded.id) {
          next = parsed;
        }
      } catch {}
    }
    setOverlay(next);
    setDocumentKind('overlay');
    setSelectedComponents([]);
    resetHistory();
    setIsPlaying(false);
    setCurrentFrame(0);
  }, [documentKind, layout, overlay, resetHistory]);

  useEffect(() => {
    if (!isPlaying || documentKind !== 'overlay' || !overlay) {
      return;
    }
    const fps = overlay.fps;
    const startFrame = overlay.startFrame;
    const endFrame = overlay.endFrame;
    const cycleLength = endFrame - startFrame + 1;
    playbackLastTimeRef.current = null;

    const step = (time: number) => {
      if (playbackLastTimeRef.current === null) {
        playbackLastTimeRef.current = time;
      }
      const elapsedSeconds = (time - playbackLastTimeRef.current) / 1000;
      playbackLastTimeRef.current = time;
      setCurrentFrame(prev => {
        if (cycleLength <= 0) return startFrame;
        const next = prev + elapsedSeconds * fps;
        return next > endFrame ? startFrame + ((next - startFrame) % cycleLength) : next;
      });
      playbackRafRef.current = requestAnimationFrame(step);
    };

    playbackRafRef.current = requestAnimationFrame(step);

    return () => {
      if (playbackRafRef.current !== null) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [isPlaying, documentKind, overlay?.fps, overlay?.startFrame, overlay?.endFrame]);

  useEffect(() => {
    if (documentKind !== 'overlay') {
      setIsPlaying(false);
    }
  }, [documentKind]);

  const handleScrubFrame = useCallback((frame: number) => {
    setCurrentFrame(frame);
  }, []);

  const handleCommitFps = useCallback((fps: number) => {
    captureHistory('Change frame rate');
    setOverlay(prev => (prev ? { ...prev, fps } : prev));
  }, [captureHistory]);

  const handleCommitStartFrame = useCallback((startFrame: number) => {
    captureHistory('Change start frame');
    setOverlay(prev => (prev ? { ...prev, startFrame: Math.min(startFrame, prev.endFrame) } : prev));
    setCurrentFrame(prev => Math.max(prev, startFrame));
  }, [captureHistory]);

  const handleCommitEndFrame = useCallback((endFrame: number) => {
    captureHistory('Change end frame');
    setOverlay(prev => (prev ? { ...prev, endFrame: Math.max(endFrame, prev.startFrame) } : prev));
    setCurrentFrame(prev => Math.min(prev, endFrame));
  }, [captureHistory]);

  const handleCommitSwitchFrame = useCallback((switchFrame: number | null) => {
    captureHistory(switchFrame === null ? 'Clear switch frame' : 'Change switch frame');
    setOverlay(prev => (prev ? setSwitchFrame(prev, switchFrame) : prev));
  }, [captureHistory]);

  const setOverlayTracks = useCallback((updater: (tracks: AnimationTrack[]) => AnimationTrack[]) => {
    setOverlay(prev => (prev ? { ...prev, tracks: updater(prev.tracks) } : prev));
  }, []);

  const setOverlayTracksAndClearDirty = useCallback((updater: (tracks: AnimationTrack[]) => AnimationTrack[]) => {
    captureHistory('Edit keyframes');
    setOverlay(prev => {
      if (!prev) return prev;
      const nextTracks = updater(prev.tracks);
      const written = findWrittenChannels(prev.tracks, nextTracks);
      if (written.length > 0) {
        setDirtyChannels(prevDirty => {
          let nextDirty = prevDirty;
          for (const { componentId, property } of written) {
            if (!isDirtyEligibleProperty(property)) continue;
            const set = nextDirty.get(componentId);
            if (!set || !set.has(property)) continue;
            if (nextDirty === prevDirty) nextDirty = new Map(prevDirty);
            const nextSet = new Set(set);
            nextSet.delete(property);
            if (nextSet.size > 0) nextDirty.set(componentId, nextSet);
            else nextDirty.delete(componentId);
          }
          return nextDirty;
        });
      }
      return { ...prev, tracks: nextTracks };
    });
  }, [captureHistory]);

  const keyframeGestureRef = useRef(false);

  const beginKeyframeGesture = useCallback(() => {
    if (keyframeGestureRef.current) return;
    keyframeGestureRef.current = true;
    beginHistoryTransaction('Edit keyframe');
  }, [beginHistoryTransaction]);

  const endKeyframeGesture = useCallback(() => {
    if (!keyframeGestureRef.current) return;
    keyframeGestureRef.current = false;
    commitHistoryTransaction('Edit keyframe');
  }, [commitHistoryTransaction]);

  const handleRetimeKeyframe = useCallback((
    componentId: string,
    property: AnimatableProperty,
    fromFrame: number,
    toFrame: number,
  ) => {
    if (!keyframeGestureRef.current) {
      captureHistoryCoalesced(`retime:${componentId}:${property}`, 'Move keyframe');
    }
    setOverlayTracks(tracks => retimeKeyframe(tracks, componentId, property, fromFrame, toFrame));
  }, [captureHistoryCoalesced, setOverlayTracks]);

  const handleRemoveKeyframe = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
  ) => {
    captureHistory('Delete keyframe');
    setOverlayTracks(tracks => removeKeyframe(tracks, componentId, property, frame));
  }, [captureHistory, setOverlayTracks]);

  const handleSetKeyframeValue = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    value: number,
  ) => {
    if (!keyframeGestureRef.current) {
      captureHistoryCoalesced(`value:${componentId}:${property}:${frame}`, 'Change keyframe value');
    }
    setOverlayTracks(tracks => setKeyframeValue(tracks, componentId, property, frame, value));
  }, [captureHistoryCoalesced, setOverlayTracks]);

  const handleInsertOnCurve = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
  ) => {
    captureHistory('Add keyframe');
    setOverlayTracks(tracks => insertKeyframeOnCurve(tracks, componentId, property, frame));
  }, [captureHistory, setOverlayTracks]);

  const handleSetKeyframeHandle = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    side: 'in' | 'out',
    handle: Handle,
  ) => {
    if (!keyframeGestureRef.current) {
      captureHistoryCoalesced(`handle:${componentId}:${property}:${frame}:${side}`, 'Adjust keyframe handle');
    }
    setOverlayTracks(tracks => setKeyframeHandle(tracks, componentId, property, frame, side, handle));
  }, [captureHistoryCoalesced, setOverlayTracks]);

  const handleSetKeyframeInterpolation = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    interpolation: Interpolation,
  ) => {
    captureHistory('Change keyframe easing');
    setOverlayTracks(tracks => setKeyframeInterpolationMode(tracks, componentId, property, frame, interpolation));
  }, [captureHistory, setOverlayTracks]);

  const handleSetKeyframeEasing = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    easing: Easing | null,
  ) => {
    captureHistory('Change keyframe easing');
    setOverlayTracks(tracks => setKeyframeEasingSpec(tracks, componentId, property, frame, easing));
  }, [captureHistory, setOverlayTracks]);

  const handleSetKeyframeEasingParams = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    easing: Easing,
  ) => {
    captureHistoryCoalesced(
      `easing:${componentId}:${property}:${frame}`,
      'Adjust keyframe easing',
    );
    setOverlayTracks(tracks => setKeyframeEasingSpec(tracks, componentId, property, frame, easing));
  }, [captureHistoryCoalesced, setOverlayTracks]);

  const handleSetKeyframeHandleMode = useCallback((
    componentId: string,
    property: AnimatableProperty,
    frame: number,
    handleMode: HandleMode,
  ) => {
    captureHistory('Change handle mode');
    setOverlayTracks(tracks => setKeyframeHandleMode(tracks, componentId, property, frame, handleMode));
  }, [captureHistory, setOverlayTracks]);

  const handlePasteKeyframe = useCallback((
    componentId: string,
    property: AnimatableProperty,
    keyframe: Keyframe,
  ) => {
    captureHistory('Paste keyframe');
    setOverlayTracks(tracks => insertKeyframe(tracks, componentId, property, keyframe));
  }, [captureHistory, setOverlayTracks]);

  const BUNDLE_VERSION = 2;

  const exportLocalStorage = useCallback(() => {
    const readArray = (key: string): unknown[] => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const bundle = {
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      presets: readArray('scoreboard-layout-presets'),
      slotTemplates: readArray('sv-slot-templates'),
      componentTemplates: readArray('sv-component-templates'),
      overlays: readArray(OVERLAY_STORAGE_KEY),
      canvasBackgroundImage: localStorage.getItem('canvas-background-image') || null,
      canvasBackgroundVisible: localStorage.getItem('canvas-background-visible') || null,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-builder-bundle-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const total =
      bundle.presets.length +
      bundle.slotTemplates.length +
      bundle.componentTemplates.length +
      bundle.overlays.length;
    toast.success(`Exported bundle (${bundle.presets.length} presets, ${bundle.slotTemplates.length} slot templates, ${bundle.componentTemplates.length} component templates, ${bundle.overlays.length} overlays — ${total} items total)`);
  }, [toast]);

  const importLocalStorage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (!data || typeof data !== 'object' || typeof data.version !== 'number' || data.version < 1 || data.version > BUNDLE_VERSION) {
            toast.error('Unrecognized bundle file — expected a layout-builder bundle.');
            return;
          }

          const writeArray = (key: string, arr: unknown) => {
            if (Array.isArray(arr)) localStorage.setItem(key, JSON.stringify(arr));
          };

          writeArray('scoreboard-layout-presets', data.presets);
          writeArray('sv-slot-templates', data.slotTemplates);
          writeArray('sv-component-templates', data.componentTemplates);
          writeArray(OVERLAY_STORAGE_KEY, data.overlays);
          if (typeof data.canvasBackgroundImage === 'string') {
            localStorage.setItem('canvas-background-image', data.canvasBackgroundImage);
          }
          if (typeof data.canvasBackgroundVisible === 'string') {
            localStorage.setItem('canvas-background-visible', data.canvasBackgroundVisible);
          }

          const presets = Array.isArray(data.presets) ? data.presets.length : 0;
          const slots = Array.isArray(data.slotTemplates) ? data.slotTemplates.length : 0;
          const comps = Array.isArray(data.componentTemplates) ? data.componentTemplates.length : 0;
          const overlaysCount = Array.isArray(data.overlays) ? data.overlays.length : 0;
          toast.success(`Imported bundle (${presets} presets, ${slots} slot templates, ${comps} component templates, ${overlaysCount} overlays). Refreshing…`);
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          toast.error('Failed to import bundle: invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(document.activeElement)) return;

      if (matchesUndoShortcut(event)) {
        event.preventDefault();
        undo();
        return;
      }
      if (matchesRedoShortcut(event)) {
        event.preventDefault();
        redo();
      }
    };

    const handleCanvasUndo = () => undo();
    const handleCanvasRedo = () => redo();

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('canvas-undo', handleCanvasUndo);
    window.addEventListener('canvas-redo', handleCanvasRedo);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('canvas-undo', handleCanvasUndo);
      window.removeEventListener('canvas-redo', handleCanvasRedo);
    };
  }, [undo, redo]);

  const inferParentId = useCallback((): string | undefined => {
    const components = activeDocument.components || [];
    if (selectedComponents.length === 0) {
      const remembered = lastContainerRef.current;
      return remembered && components.some(c => c.id === remembered) ? remembered : undefined;
    }

    const parentOf = (id: string): string | undefined => {
      const component = components.find(c => c.id === id);
      if (!component) return undefined;
      return component.type === 'group' ? component.id : component.parentId;
    };

    const contexts = new Set(selectedComponents.map(parentOf));
    if (contexts.size !== 1) return undefined;

    const context = contexts.values().next().value;
    if (!context) return undefined;

    const container = components.find(c => c.id === context);
    if (container?.type === 'multiState' && Array.isArray(container.props?.states)) {
      const states = container.props.states;
      const pinned = container.props.previewStateId;
      const activeId = pinned && pinned !== 'auto' && states.some((st: any) => st.id === pinned)
        ? pinned
        : resolveActiveStateId(states, gameData);
      return states.find((st: any) => st.id === activeId)?.childId;
    }

    return context;
  }, [activeDocument.components, selectedComponents, gameData]);

  const lastContainerRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (selectedComponents.length === 0) return;
    lastContainerRef.current = inferParentId();
  }, [selectedComponents, inferParentId]);

  const addComponent = useCallback((
    type: ComponentConfig['type'],
    customPosition?: { x: number, y: number },
    customSize?: { width: number, height: number },
    customProps?: Record<string, any>,
    customDisplayName?: string,
    parentId?: string,
    customId?: string,
    customLayer?: number,
    extraProps?: Partial<ComponentConfig>
  ): string => {
    const componentId = customId || generateComponentId(type);
    const resolvedParentId = parentId ?? inferParentId();

    captureHistory(`Add ${type} component`);

    setActiveDocument(prev => {
      const baseName = customDisplayName || getDefaultDisplayName(type);
      const existingNames = new Set(
        (prev.components || [])
          .map(c => c.displayName || c.type)
          .filter(Boolean)
      );

      let uniqueName = baseName;
      if (existingNames.has(uniqueName)) {
        let counter = 2;
        while (existingNames.has(`${baseName}${counter}`)) {
          counter++;
        }
        uniqueName = `${baseName}${counter}`;
      }

      const siblings = (prev.components || []).filter(c => c.parentId === resolvedParentId);
      const maxRootLayer = siblings.reduce((max, comp) => Math.max(max, comp.layer || 0), -1);

      const newComponent: ComponentConfig = {
        id: componentId,
        displayName: uniqueName,
        type,
        position: customPosition || { x: 192, y: 108 },
        size: customSize || getDefaultSize(type),
        layer: customLayer !== undefined ? customLayer : maxRootLayer + 1,
        props: customProps || getDefaultProps(type),
        team: needsTeam(type) ? 'home' : undefined,
        parentId: resolvedParentId,
        ...extraProps
      };

      return {
        ...prev,
        components: [...(prev.components || []), newComponent]
      };
    });

    return componentId;
  }, [captureHistory, generateComponentId, inferParentId, setActiveDocument]);

  const addShape = useCallback((presetKey: string) => {
    const preset = SHAPE_PRESETS[presetKey];
    if (!preset) return;
    addComponent(
      'shape',
      undefined,
      { ...preset.defaultSize },
      {
        ...getDefaultProps('shape'),
        ...(preset.props || {}),
        shape: structuredClone(preset.shape),
      },
      preset.label
    );
  }, [addComponent]);

  const isDraggingRef = React.useRef(false);

  const updateComponent = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    const roundedUpdates = { ...updates };
    if (roundedUpdates.position) {
      roundedUpdates.position = {
        x: Math.round(roundedUpdates.position.x),
        y: Math.round(roundedUpdates.position.y),
      };
    }
    if (roundedUpdates.size) {
      roundedUpdates.size = {
        width: Math.round(roundedUpdates.size.width),
        height: Math.round(roundedUpdates.size.height),
      };
    }

    const existing = currentComponents().find(c => c.id === id);
    if (existing) {
      const changedKeys = Object.keys(roundedUpdates);
      const isPropertyUpdate = changedKeys.some(key => !['position', 'size'].includes(key));
      if (isPropertyUpdate && !isDraggingRef.current) {
        captureHistoryCoalesced(
          `update:${changedKeys.sort().join(',')}`,
          `Update ${existing.type} properties`,
        );
      }

      if (documentKind === 'overlay') {
        const changed = changedDirtyChannelsForUpdate(existing, roundedUpdates);
        if (changed.length > 0) markChannelsDirty(id, changed);
      }
    }

    setActiveDocument(prev => {
      return {
        ...prev,
        components: (prev.components || []).map(comp =>
          comp.id === id ? { ...comp, ...roundedUpdates } : comp
        )
      };
    });
  }, [captureHistoryCoalesced, currentComponents, setActiveDocument, documentKind, markChannelsDirty]);

  const startDragOperation = useCallback(() => {
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    beginHistoryTransaction('Move component');
  }, [beginHistoryTransaction]);

  const endDragOperation = useCallback((description: string, mergeKey?: string) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    commitHistoryTransaction(description, mergeKey);
  }, [commitHistoryTransaction]);

  const deleteComponent = useCallback((id: string) => {
    const component = currentComponents().find(c => c.id === id);
    if (!component) return;

    captureHistoryCoalesced('delete-components', `Delete ${component.type} component`);
    setSelectedComponents(prevSelected => prevSelected.filter(compId => compId !== id));

    setActiveDocument(prev => ({
      ...prev,
      components: (prev.components || []).filter(comp => comp.id !== id),
    }));

    if (documentKind === 'overlay') {
      setOverlayTracks(tracks => pruneTracksForComponent(tracks, id));
    }
  }, [captureHistoryCoalesced, currentComponents, setActiveDocument, documentKind, setOverlayTracks]);

  const copyTracksForNewComponents = useCallback((
    idMapping: Map<string, string>,
    sourceTracks?: AnimationTrack[],
  ) => {
    if (documentKind !== 'overlay' || idMapping.size === 0) return;
    setOverlayTracks(tracks => {
      const additions = remapTracksForComponents(sourceTracks ?? tracks, idMapping);
      return additions.length === 0 ? tracks : [...tracks, ...additions];
    });
  }, [documentKind, setOverlayTracks]);

  const uniqueDisplayName = useCallback((baseName: string, taken: Set<string>): string => {
    if (!taken.has(baseName)) return baseName;
    let counter = 2;
    while (taken.has(`${baseName}${counter}`)) counter++;
    return `${baseName}${counter}`;
  }, []);

  const duplicateComponent = useCallback((id: string) => {
    const components = currentComponents();
    const original = components.find(comp => comp.id === id);
    if (!original) return;

    const duplicateId = generateComponentId(original.type);
    const taken = new Set(components.map(c => c.displayName || c.type).filter(Boolean));
    const duplicate: ComponentConfig = {
      ...original,
      id: duplicateId,
      displayName: uniqueDisplayName(original.displayName || original.type, taken),
      position: { ...original.position },
    };

    captureHistoryCoalesced('duplicate-components', `Duplicate ${original.type} component`);
    setActiveDocument(prev => ({
      ...prev,
      components: [...(prev.components || []), duplicate],
    }));
    copyTracksForNewComponents(new Map([[id, duplicateId]]));
    setSelectedComponents([duplicateId]);
  }, [captureHistoryCoalesced, currentComponents, generateComponentId, uniqueDisplayName, setActiveDocument, copyTracksForNewComponents]);

  const cloneComponents = useCallback((
    source: ComponentConfig[],
    existing: ComponentConfig[],
  ): { clones: ComponentConfig[]; idMapping: Map<string, string> } => {
    const idMapping = new Map<string, string>();
    for (const comp of source) {
      idMapping.set(comp.id, generateComponentId(comp.type));
    }

    const existingIds = new Set(existing.map(c => c.id));
    const taken = new Set(existing.map(c => c.displayName || c.type).filter(Boolean));

    const clones = source.map(comp => {
      const displayName = uniqueDisplayName(comp.displayName || comp.type, taken);
      taken.add(displayName);

      return {
        ...comp,
        id: idMapping.get(comp.id)!,
        displayName,
        parentId: comp.parentId
          ? (idMapping.get(comp.parentId) ?? (existingIds.has(comp.parentId) ? comp.parentId : undefined))
          : undefined,
        position: { ...comp.position },
      };
    });

    return { clones, idMapping };
  }, [generateComponentId, uniqueDisplayName]);

  const copyDragComponents = useCallback((ids: string[]): Map<string, string> => {
    const components = currentComponents();
    const { rootIds, collected } = collectWithDescendants(components, ids);
    if (collected.length === 0) return new Map();

    const { clones, idMapping } = cloneComponents(collected, components);

    captureHistory(`Copy-drag ${collected.length} component(s)`);
    setActiveDocument(prev => ({
      ...prev,
      components: [...(prev.components || []), ...clones],
    }));
    copyTracksForNewComponents(idMapping);
    setSelectedComponents(rootIds.map(id => idMapping.get(id)!));

    return idMapping;
  }, [captureHistory, currentComponents, cloneComponents, setActiveDocument, copyTracksForNewComponents]);

  const copyComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    const { collected } = collectWithDescendants(currentComponents(), selectedComponents);
    if (collected.length === 0) return;

    const copiedIds = new Set(collected.map(c => c.id));
    const copiedTracks = documentKind === 'overlay' && overlayRef.current
      ? overlayRef.current.tracks.filter(t => copiedIds.has(t.componentId))
      : [];

    setClipboard({
      components: structuredClone(collected),
      tracks: structuredClone(copiedTracks),
    });
  }, [selectedComponents, currentComponents, documentKind]);

  const pasteComponents = useCallback(() => {
    if (!clipboard || clipboard.components.length === 0) return;

    const components = currentComponents();
    const { clones, idMapping } = cloneComponents(clipboard.components, components);

    captureHistory(`Paste ${clipboard.components.length} component(s)`);
    setActiveDocument(prev => ({
      ...prev,
      components: [...(prev.components || []), ...clones],
    }));
    copyTracksForNewComponents(idMapping, clipboard.tracks);

    const clipboardIds = new Set(clipboard.components.map(c => c.id));
    const rootIds = clipboard.components
      .filter(c => !c.parentId || !clipboardIds.has(c.parentId))
      .map(c => idMapping.get(c.id)!);
    setSelectedComponents(rootIds);
  }, [clipboard, currentComponents, cloneComponents, captureHistory, setActiveDocument, copyTracksForNewComponents]);

  const groupSelectedComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    const components = currentComponents();
    const selectedComps = components.filter(c => selectedComponents.includes(c.id));
    if (selectedComps.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedComps.forEach(c => {
      minX = Math.min(minX, c.position.x);
      minY = Math.min(minY, c.position.y);
      maxX = Math.max(maxX, c.position.x + c.size.width);
      maxY = Math.max(maxY, c.position.y + c.size.height);
    });

    const groupId = generateComponentId('group');
    const groupName = uniqueDisplayName(
      'Group',
      new Set(components.map(c => c.displayName || c.type).filter(Boolean)),
    );

    const maxSelectedLayer = selectedComps.reduce((max, c) => Math.max(max, c.layer || 0), 0);

    const groupComponent: ComponentConfig = {
      id: groupId,
      type: 'group',
      displayName: groupName,
      position: { x: Math.round(minX), y: Math.round(minY) },
      size: { width: Math.round(maxX - minX), height: Math.round(maxY - minY) },
      layer: maxSelectedLayer
    };

    captureHistory(`Group ${selectedComps.length} components`);

    setActiveDocument(prev => {
      const updatedComponents = (prev.components || []).map(c => {
        if (selectedComponents.includes(c.id)) {
          return {
            ...c,
            parentId: groupId,
          };
        }
        return c;
      });

      return {
        ...prev,
        components: [...updatedComponents, groupComponent]
      };
    });

    setSelectedComponents([groupId]);
  }, [selectedComponents, currentComponents, captureHistory, generateComponentId, uniqueDisplayName, setActiveDocument]);

  const ungroupSelectedComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    const groups = currentComponents().filter(
      c => selectedComponents.includes(c.id) && c.type === 'group'
    );
    if (groups.length === 0) return;

    captureHistory(`Ungroup ${groups.length} group(s)`);

    const groupIds = new Set(groups.map(g => g.id));
    const childrenIds = currentComponents()
      .filter(c => c.parentId && groupIds.has(c.parentId))
      .map(c => c.id);

    setActiveDocument(prev => {
      const components = prev.components || [];

      const updatedComponents = components
        .filter(c => !groupIds.has(c.id))
        .map(c => {
          if (c.parentId && groupIds.has(c.parentId)) {
            return { ...c, parentId: undefined };
          }
          return c;
        });

      return {
        ...prev,
        components: updatedComponents
      };
    });

    setSelectedComponents(childrenIds);
  }, [selectedComponents, currentComponents, captureHistory, setActiveDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedComponents.length > 0) {
          e.preventDefault();
          copyComponents();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard && clipboard.components.length > 0) {
          e.preventDefault();
          pasteComponents();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        if (selectedComponents.length > 0) {
          e.preventDefault();
          groupSelectedComponents();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'G' && e.shiftKey) {
        if (selectedComponents.length > 0) {
          e.preventDefault();
          ungroupSelectedComponents();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponents, clipboard, copyComponents, pasteComponents, groupSelectedComponents, ungroupSelectedComponents]);

  const loadCustomPreset = useCallback((customLayout: LayoutConfig) => {
    const { components: repairedComponents, repaired, brokenRefs } = repairTemplateReferences(customLayout.components || []);

    captureHistory(`Load custom preset "${customLayout.name}"`);
    setSelectedComponents([]);
    setLayout({
      ...customLayout,
      components: repairedComponents,
    });

    if (repaired > 0) {
      console.log(`Repaired ${repaired} template reference(s) in loaded layout`);
      toast.success(`Auto-repaired ${repaired} template reference(s)`);
    }
    if (brokenRefs.length > 0) {
      console.warn(`${brokenRefs.length} slotList component(s) have missing templates`);
      toast.warning(`${brokenRefs.length} slot list(s) have missing templates. Select templates in the property panel.`, 6000);
    }
  }, [captureHistory, toast]);

  const handleUpdateLayout = useCallback((updates: Partial<LayoutConfig>) => {
    setActiveDocument(prev => ({
      ...prev,
      ...updates,
      dimensions: updates.dimensions ? { ...prev.dimensions, ...updates.dimensions } : prev.dimensions
    }));
  }, [setActiveDocument]);

  if (!isUnlocked) {
    return <Fake404Overlay onDismiss={handleUnlock} />;
  }

  return (
    <div className="app" role="application" aria-label="Layout Builder">
      <a href="#main-canvas" className="skip-link">Skip to canvas</a>
      <header className="app-header" role="banner">
        <div className="header-section header-branding">
          <h1 className="header-title">Layout Builder</h1>
          <div className="header-divider" aria-hidden="true" />
          {documentKind === 'overlay' ? (
            <>
              <label htmlFor="overlay-name-input" className="sr-only">Overlay name</label>
              <input
                id="overlay-name-input"
                type="text"
                value={overlay?.name || ''}
                onChange={(e) => setOverlay(prev => prev ? { ...prev, name: e.target.value } : prev)}
                className="header-input"
                placeholder="Overlay name"
                aria-label="Overlay name"
              />
            </>
          ) : (
            <span
              className="header-btn header-btn-secondary"
              style={{ cursor: 'default' }}
              role="status"
              aria-label={`Currently editing layout: ${layout.name || 'Untitled Layout'}`}
            >
              {`Layout: ${layout.name || 'Untitled Layout'}`}
            </span>
          )}
          {documentKind === 'layout' ? null : (
            <button
              onClick={switchToLayout}
              className="header-btn header-btn-secondary"
              aria-label="Save overlay and switch back to editing the layout"
            >
              Back to Layout
            </button>
          )}
          <div className="header-divider" aria-hidden="true" />
          {documentKind === 'layout' && (
            <>
              <label htmlFor="layout-type-select" className="sr-only">Layout Type</label>
              <select
                id="layout-type-select"
                value={LAYOUT_TYPES.some(t => t.value === layout.name) ? layout.name : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    if (LAYOUT_TYPES.some(t => t.value === layout.name)) {
                      setLayout(prev => ({ ...prev, name: '' }));
                    }
                  } else {
                    setLayout(prev => ({ ...prev, name: e.target.value }));
                  }
                }}
                className="header-select"
                aria-label="Select layout type"
              >
                {LAYOUT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
              {!LAYOUT_TYPES.some(t => t.value === layout.name) && (
                <input
                  type="text"
                  value={layout.name}
                  onChange={(e) => setLayout(prev => ({ ...prev, name: e.target.value }))}
                  className="header-input"
                  placeholder="Custom type"
                  aria-label="Custom layout type identifier"
                />
              )}
            </>
          )}
        </div>

        <div className="header-section header-edit" role="toolbar" aria-label="Edit operations">
            <button
              onClick={undo}
              disabled={!history.canUndo}
              className="header-btn header-btn-secondary"
              aria-label={history.undoLabel ? `Undo: ${history.undoLabel}` : 'Nothing to undo'}
              aria-keyshortcuts="Control+Z"
            >
              Undo {history.undoDepth > 0 && <span className="btn-badge" aria-label={`${history.undoDepth} actions`}>{history.undoDepth}</span>}
            </button>
            <button
              onClick={redo}
              disabled={!history.canRedo}
              className="header-btn header-btn-secondary"
              aria-label={history.redoLabel ? `Redo: ${history.redoLabel}` : 'Nothing to redo'}
              aria-keyshortcuts="Control+Shift+Z"
            >
              Redo {history.redoDepth > 0 && <span className="btn-badge" aria-label={`${history.redoDepth} actions`}>{history.redoDepth}</span>}
            </button>
          </div>

        <div className="header-section header-file" role="toolbar" aria-label="File operations">
            {documentKind === 'layout' && (
              <>
                <button
                  onClick={quickSavePreset}
                  className="header-btn header-btn-primary"
                  aria-label="Quick save current layout as a preset"
                  aria-keyshortcuts="Control+S"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowPresetModal(true)}
                  className="header-btn header-btn-secondary"
                  aria-label="Open preset manager"
                >
                  Presets
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="header-btn header-btn-accent"
                  aria-label="Export layout as JSON"
                >
                  Export
                </button>
              </>
            )}
            {documentKind === 'overlay' && overlay && (
              <>
                <button
                  onClick={saveCurrentOverlay}
                  className="header-btn header-btn-primary"
                  aria-label="Save current overlay"
                  aria-keyshortcuts="Control+S"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowOverlayExportModal(true)}
                  className="header-btn header-btn-accent"
                  aria-label="Export overlay as JSON"
                >
                  Export
                </button>
              </>
            )}
            <button
              onClick={() => setShowOverlayLibrary(true)}
              className="header-btn header-btn-secondary"
              aria-label="Open overlay library"
            >
              Overlays
            </button>
            <span style={{ width: '1px', height: '20px', backgroundColor: '#444', margin: '0 4px' }} aria-hidden="true" />
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="header-btn header-btn-icon"
              aria-label="Show keyboard shortcuts"
              aria-keyshortcuts="?"
              title="Keyboard Shortcuts (?)"
            >
              ?
            </button>
          </div>
      </header>

      <main className="app-body" id="main-canvas" role="main">
            <aside
              className={`panel-container left-panel ${isResizingLeft ? 'resizing' : ''}`}
              style={{ width: leftPanelWidth }}
              role="complementary"
              aria-label="Layers panel"
            >
              <MemoizedLayerPanel
                layout={activeDocument}
                selectedComponents={selectedComponents}
                onSelectComponents={handleSelectComponents}
                onUpdateComponent={updateComponent}
                onDeleteComponent={deleteComponent}
                onAddComponent={addComponent}
                onAddShape={addShape}
                onStartDragOperation={startDragOperation}
                onEndDragOperation={endDragOperation}
                onCopyComponents={copyComponents}
                onPasteComponents={pasteComponents}
                hasClipboard={clipboard !== null && clipboard.components.length > 0}
                templateRefreshKey={templateRefreshKey}
              />
              <div
                className="panel-resize-edge right-edge"
                onMouseDown={handleLeftResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize layers panel"
              />
            </aside>

            <MemoizedCanvas
              layout={activeDocument}
              selectedComponents={selectedComponents}
              onSelectComponents={handleSelectFromCanvas}
              onUpdateComponent={updateComponent}
              onDeleteComponent={deleteComponent}
              onDuplicateComponent={duplicateComponent}
              onCopyDragComponents={copyDragComponents}
              draggedComponent={draggedComponent}
              setDraggedComponent={setDraggedComponent}
              onAddComponent={addComponent}
              onStartDragOperation={startDragOperation}
              onEndDragOperation={endDragOperation}
              onUpdateLayout={handleUpdateLayout}
              gameData={gameData}
              editingShapeId={editingShapeId}
              onSetEditingShape={setEditingShapeId}
              selectedVertices={selectedVertices}
              onSelectVertices={setSelectedVertices}
              documentKind={documentKind}
              overlayTracks={documentKind === 'overlay' ? overlay?.tracks : undefined}
              currentFrame={currentFrame}
              dirtyChannels={documentKind === 'overlay' ? dirtyChannels : undefined}
            />

            <aside
              className={`panel-container right-panel ${isResizingRight ? 'resizing' : ''}`}
              style={{ width: rightPanelWidth }}
              role="complementary"
              aria-label="Properties panel"
            >
              <div
                className="panel-resize-edge left-edge"
                onMouseDown={handleRightResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize properties panel"
              />
              <MemoizedPropertyPanel
                layout={activeDocument}
                selectedComponents={selectedComponents}
                onUpdateComponent={updateComponent}
                onUpdateLayout={handleUpdateLayout}
                gameData={gameData}
                onUpdateGameData={setGameData}
                panelWidth={rightPanelWidth}
                templateRefreshKey={templateRefreshKey}
                editingShapeId={editingShapeId}
                selectedVertices={selectedVertices}
                onStartDragOperation={startDragOperation}
                onEndDragOperation={endDragOperation}
                documentKind={documentKind}
                overlayTracks={documentKind === 'overlay' ? overlay?.tracks : undefined}
                currentFrame={currentFrame}
                onSetOverlayTracks={setOverlayTracksAndClearDirty}
              />
            </aside>
      </main>

      {documentKind === 'overlay' && overlay && (
        <MemoizedTimelinePanel
          overlay={overlay}
          currentFrame={currentFrame}
          isPlaying={isPlaying}
          onScrub={handleScrubFrame}
          onPlayPause={setIsPlaying}
          onCommitFps={handleCommitFps}
          onCommitStartFrame={handleCommitStartFrame}
          onCommitEndFrame={handleCommitEndFrame}
          onCommitSwitchFrame={handleCommitSwitchFrame}
          components={activeDocument.components || []}
          selectedComponentIds={selectedComponents}
          onRetimeKeyframe={handleRetimeKeyframe}
          onBeginKeyframeGesture={beginKeyframeGesture}
          onEndKeyframeGesture={endKeyframeGesture}
          onRemoveKeyframe={handleRemoveKeyframe}
          onPasteKeyframe={handlePasteKeyframe}
          onSetKeyframeValue={handleSetKeyframeValue}
          onInsertOnCurve={handleInsertOnCurve}
          onSetKeyframeHandle={handleSetKeyframeHandle}
          onSetKeyframeInterpolation={handleSetKeyframeInterpolation}
          onSetKeyframeEasing={handleSetKeyframeEasing}
          onSetKeyframeEasingParams={handleSetKeyframeEasingParams}
          onSetKeyframeHandleMode={handleSetKeyframeHandleMode}
          editingShapeId={editingShapeId}
          panelHeight={timelinePanelHeight}
          onPanelHeightChange={setTimelinePanelHeight}
          minPanelHeight={MIN_TIMELINE_PANEL_HEIGHT}
          maxPanelHeight={MAX_TIMELINE_PANEL_HEIGHT}
        />
      )}

      {showExportModal && (
        <MemoizedExportModal
          layout={layout}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showOverlayExportModal && overlay && (
        <MemoizedOverlayExportModal
          overlay={overlay}
          onClose={() => setShowOverlayExportModal(false)}
        />
      )}

      {showPresetModal && (
        <MemoizedPresetModal
          layout={layout}
          onClose={() => setShowPresetModal(false)}
          onLoadPreset={loadCustomPreset}
          onLoadOverlay={loadOverlayFromLibrary}
          onBackup={exportLocalStorage}
          onRestore={importLocalStorage}
        />
      )}

      {showOverlayLibrary && (
        <MemoizedOverlayLibraryModal
          dimensions={layout.dimensions}
          onClose={() => setShowOverlayLibrary(false)}
          onLoadOverlay={loadOverlayFromLibrary}
        />
      )}

      <MemoizedKeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}

function getDefaultSize(type: ComponentConfig['type']) {
  const sizes = {
    teamName: { width: 480, height: 130 },
    score: { width: 288, height: 194 },
    clock: { width: 384, height: 162 },
    period: { width: 230, height: 162 },
    fouls: { width: 192, height: 130 },
    timeouts: { width: 384, height: 86 },
    bonus: { width: 154, height: 130 },
    custom: { width: 192, height: 108 },
    dynamicList: { width: 300, height: 60 },
    leaderboardList: { width: 300, height: 340 },
    multiState: { width: 0, height: 0 },
    shape: { width: 384, height: 216 },
    qrCode: { width: 240, height: 240 },
  };
  return (sizes as Record<string, {width:number;height:number}>)[type] || { width: 192, height: 108 };
}

function getDefaultProps(type: ComponentConfig['type']) {
  const props = {
    teamName: { fontSize: 24, textColor: '#ffffff', textAlign: 'center' },
    score: { fontSize: 48, textColor: '#ffffff', textAlign: 'center' },
    clock: { fontSize: 32, textColor: '#ffffff', textAlign: 'center' },
    period: { fontSize: 20, label: 'PERIOD', textColor: '#ffffff', textAlign: 'center' },
    fouls: { fontSize: 18, label: 'FOULS', textColor: '#ffffff', textAlign: 'center' },
    timeouts: { maxTimeouts: 5, textColor: '#ffffff', textAlign: 'center' },
    bonus: { fontSize: 16, textColor: '#ffffff', textAlign: 'center' },
    custom: {
      dataPath: 'none',
      label: '',
      fontSize: 24,
      format: 'text',
      prefix: '',
      suffix: '',
      backgroundColor: '#333333',
      textColor: '#ffffff',
      textAlign: 'center',
      imageSource: 'local',
      borderWidth: 0,
      borderColor: '#ffffff',
      borderStyle: 'solid',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0
    },
    dynamicList: {
      totalCount: 5,
      activeCount: 2,
      activeBackgroundColor: '#4CAF50',
      activeTextColor: '#ffffff',
      activeBorderWidth: 0,
      activeBorderColor: '#ffffff',
      inactiveBackgroundColor: '#666666',
      inactiveTextColor: '#ffffff',
      inactiveBorderWidth: 0,
      inactiveBorderColor: '#ffffff',
      direction: 'horizontal',
      itemAlignment: 'start',
      itemSpacing: 4,
      borderRadius: 4,
      showNumbers: false,
      reverseOrder: false,
      borderWidth: 0,
      borderColor: '#ffffff'
    },
    leaderboardList: {
      visibleCount: 5,
      rowHeight: 60,
      rowSpacing: 8,
      backgroundColor: 'transparent',
      rowBackgroundColor: 'rgba(0, 0, 0, 0.5)',
      textColor: '#ffffff',
      fontSize: 24,
      showRank: true,
      showScore: true,
      rankWidth: 40,
      scoreWidth: 60,
      borderRadius: 4,
      cycleEnabled: false,
      cycleInterval: 5000,
      cycleTransition: 'fade',
      cycleDuration: 500
    },
    qrCode: {
      dataPath: 'trivia.joinUrl',
      color: '#000000',
      backgroundColor: '#ffffff',
      ecl: 'M',
    },
    shape: {
      shape: structuredClone(SHAPE_PRESETS.rectangle.shape),
      fillType: 'solid',
      fillColor: '#4CAF50',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 0,
      strokeOpacity: 1,
      strokeCap: 'butt',
    },
  };
  return (props as Record<string, unknown>)[type] || {};
}

function getDefaultDisplayName(type: ComponentConfig['type']) {
  if (type === 'group') return 'Layer';
  if (type === 'multiState') return 'Multi-State';
  return type;
}

function needsTeam(type: ComponentConfig['type']): boolean {
  return ['teamName', 'score', 'fouls', 'timeouts', 'bonus'].includes(type);
}

function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

export default AppWithToast;