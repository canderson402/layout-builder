import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ComponentConfig, LayoutConfig, LAYOUT_TYPES } from './types';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import LayerPanel from './components/LayerPanel';
import ExportModal from './components/ExportModal';
import PresetModal from './components/PresetModal';
import { expandLayoutForExport } from './utils/slotTemplates';
import './App.css';

// Panel resize constants
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_LEFT_PANEL_WIDTH = 250;
const DEFAULT_RIGHT_PANEL_WIDTH = 320;

const DEVICE_PRESETS = {
  '1080p TV (1920x1080)': { width: 1920, height: 1080 },
  '4K TV (3840x2160)': { width: 1920, height: 1080 }, // Scaled down for display
  'HD TV (1280x720)': { width: 1280, height: 720 },
  'Custom 16:9': { width: 1600, height: 900 }
} as const;

// Pre-computed default dimensions to avoid object recreation
const DEFAULT_DIMENSIONS = DEVICE_PRESETS['1080p TV (1920x1080)'];

// Undo action types
type UndoAction = {
  type: 'UPDATE_LAYOUT' | 'ADD_COMPONENT' | 'UPDATE_COMPONENT' | 'DELETE_COMPONENT' | 'DUPLICATE_COMPONENT' | 'LOAD_PRESET';
  description: string;
  previousLayout: LayoutConfig;
};

// Memoized child components to prevent unnecessary re-renders
const MemoizedCanvas = React.memo(Canvas);
const MemoizedLayerPanel = React.memo(LayerPanel);
const MemoizedPropertyPanel = React.memo(PropertyPanel);
const MemoizedExportModal = React.memo(ExportModal);
const MemoizedPresetModal = React.memo(PresetModal);

// Fake 404 overlay component for obfuscation
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
  // Obfuscation state - check sessionStorage to persist during session
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('layout-builder-unlocked') === 'true';
  });

  const handleUnlock = useCallback(() => {
    setIsUnlocked(true);
    sessionStorage.setItem('layout-builder-unlocked', 'true');
  }, []);

  const [layout, setLayout] = useState<LayoutConfig>({
    name: 'basketball', // Layout type identifier used by TV app
    components: [],
    backgroundColor: '#000000',
    dimensions: DEFAULT_DIMENSIONS
  });

  // Game data state for live preview
  const [gameData, setGameData] = useState({
    homeTeam: {
      name: 'HOME',
      score: 1,
      fouls: 4,
      timeouts: 3,
      bonus: true,
      doubleBonus: false,
      possession: false,
      color: '#c41e3a'
    },
    awayTeam: {
      name: 'AWAY',
      score: 0,
      fouls: 6,
      timeouts: 2,
      bonus: false,
      doubleBonus: true,
      possession: true,
      color: '#003f7f'
    },
    gameClock: '5:42',
    activityClock: '1:30',
    timeoutClock: '0:30',
    timerName: 'Timer Name',
    sessionName: 'Session Name',
    nextUp: 'Next Up',
    period: 4,
    shotClock: 14,
    quarter: 4,
    half: 2,
    set: 3,
    isOvertime: false,
    home_sets_won: 0,
    away_sets_won: 0,
    home_player_points: 0,
    away_player_points: 0,
    home_player_name: 'Green',
    away_player_name: 'Red',
    home_team_color: '#c41e3a',
    away_team_color: '#003f7f',
    // Lacrosse/Hockey shots and saves
    home_shots: 0,
    away_shots: 0,
    home_saves: 0,
    away_saves: 0,
    // Penalty slots for lacrosse/hockey preview
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
    // Leaderboard slots for player stats preview
    leaderboardSlots: {
      home: {
        count: 5,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: true,
        slot0: { jersey: '23', name: 'M. Jordan', points: 30, fouls: 2, isTopScorer: true, active: true },
        slot1: { jersey: '33', name: 'S. Pippen', points: 22, fouls: 3, isTopScorer: false, active: true },
        slot2: { jersey: '91', name: 'D. Rodman', points: 8, fouls: 4, isTopScorer: false, active: true },
        slot3: { jersey: '7', name: 'T. Kukoc', points: 12, fouls: 1, isTopScorer: false, active: true },
        slot4: { jersey: '25', name: 'S. Kerr', points: 6, fouls: 0, isTopScorer: false, active: true },
      },
      away: {
        count: 5,
        isState0: false,
        isState1: false,
        isState2: false,
        isState3: false,
        isState4: false,
        isState5: true,
        slot0: { jersey: '32', name: 'K. Malone', points: 28, fouls: 3, isTopScorer: true, active: true },
        slot1: { jersey: '12', name: 'J. Stockton', points: 18, fouls: 2, isTopScorer: false, active: true },
        slot2: { jersey: '4', name: 'J. Hornacek', points: 14, fouls: 1, isTopScorer: false, active: true },
        slot3: { jersey: '53', name: 'M. Eaton', points: 4, fouls: 4, isTopScorer: false, active: true },
        slot4: { jersey: '35', name: 'A. Carr', points: 10, fouls: 2, isTopScorer: false, active: true },
      },
    }
  });

  // Remove expensive console.log - causes performance issues

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<ComponentConfig | null>(null);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<ComponentConfig[] | null>(null);
  
  // Undo/Redo system - keep track of last 50 actions each
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);
  
  // Component naming counter system
  
  // TV endpoint controls
  const [tvIpAddress, setTvIpAddress] = useState('192.168.1.100'); // Default IP
  const [isSendingToTv, setIsSendingToTv] = useState(false);

  // Panel resize state
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Panel resize handlers
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

  // Generate unique component ID using UUID
  const generateComponentId = useCallback((type: ComponentConfig['type']) => {
    const uuid = crypto.randomUUID();
    return `${type}_${uuid}`;
  }, []);

  // Save state for undo - optimized to avoid deep cloning
  const saveStateForUndo = useCallback((actionType: UndoAction['type'], description: string, currentLayout: LayoutConfig) => {
    setUndoHistory(prev => {
      const newAction: UndoAction = {
        type: actionType,
        description,
        previousLayout: structuredClone(currentLayout) // More efficient than JSON parse/stringify
      };
      
      // Keep only last 50 actions
      const newHistory = [newAction, ...prev].slice(0, 50);
      return newHistory;
    });
    
    // Clear redo history when a new action is performed
    setRedoHistory([]);
  }, []);

  // Undo function - optimized to avoid layout dependency
  const undo = useCallback(() => {
    setUndoHistory(prev => {
      if (prev.length === 0) return prev;
      
      const [lastAction, ...remainingHistory] = prev;
      
      // Save current state to redo history before undoing
      setLayout(currentLayout => {
        const currentRedoAction: UndoAction = {
          type: lastAction.type,
          description: lastAction.description,
          previousLayout: structuredClone(currentLayout) // More efficient cloning
        };
        
        setRedoHistory(prevRedo => [currentRedoAction, ...prevRedo].slice(0, 50)); // Keep last 50 redo actions
        setSelectedComponents([]); // Clear selection after undo
        return lastAction.previousLayout;
      });
      
      return remainingHistory;
    });
  }, []);

  // Redo function - optimized to avoid layout dependency
  const redo = useCallback(() => {
    setRedoHistory(prev => {
      if (prev.length === 0) return prev;
      
      const [lastRedoAction, ...remainingRedoHistory] = prev;
      
      // Save current state to undo history before redoing
      setLayout(currentLayout => {
        const currentUndoAction: UndoAction = {
          type: lastRedoAction.type,
          description: lastRedoAction.description,
          previousLayout: structuredClone(currentLayout) // More efficient cloning
        };
        
        setUndoHistory(prevUndo => [currentUndoAction, ...prevUndo].slice(0, 50)); // Keep last 50 undo actions
        setSelectedComponents([]); // Clear selection after redo
        return lastRedoAction.previousLayout;
      });
      
      return remainingRedoHistory;
    });
  }, []);

  // Send layout to TV endpoint
  const sendLayoutToTv = useCallback(async () => {
    if (!tvIpAddress.trim()) {
      alert('Please enter a valid TV IP address');
      return;
    }

    setIsSendingToTv(true);
    try {
      // Remove port if already included in IP address, then add :3080
      const cleanIp = tvIpAddress.replace(/:.*$/, '');

      // Debug payload size and content
      const layoutJson = JSON.stringify(layout);
      const payloadSize = new Blob([layoutJson]).size;
      console.log('📦 Layout payload size:', payloadSize, 'bytes');
      console.log('📋 Layout components count:', layout.components?.length || 0);
      console.log('📄 Layout structure:', {
        name: layout.name,
        dimensions: layout.dimensions,
        componentCount: layout.components?.length || 0,
        hasComponents: !!layout.components
      });

      // Validate JSON can be parsed back
      try {
        const testParse = JSON.parse(layoutJson);
        console.log('✅ JSON validation passed');

        // Check for required fields
        if (!testParse.name || !testParse.components || !testParse.dimensions) {
          console.warn('⚠️ Missing required fields:', {
            hasName: !!testParse.name,
            hasComponents: !!testParse.components,
            hasDimensions: !!testParse.dimensions
          });
        }
      } catch (jsonError) {
        console.error('❌ JSON validation failed:', jsonError);
        alert('Invalid layout data - JSON formatting error');
        return;
      }

      // Warn if payload is very large
      if (payloadSize > 1024 * 1024) { // 1MB
        console.warn('⚠️ Large payload detected:', (payloadSize / 1024 / 1024).toFixed(2), 'MB');
      }

      // Log a sample of the JSON for debugging
      console.log('📄 JSON sample (first 500 chars):', layoutJson.substring(0, 500));

      // Binary search to find the breaking point efficiently
      console.log('🔍 Binary search for maximum working component count...');

      const totalComponents = layout.components?.length || 0;
      let workingCount = 5; // We know 5 works
      let failingCount = totalComponents;

      while (workingCount + 1 < failingCount) {
        const testCount = Math.floor((workingCount + failingCount) / 2);

        const testLayout = {
          name: layout.name,
          components: layout.components?.slice(0, testCount) || [],
          dimensions: layout.dimensions,
          backgroundColor: layout.backgroundColor
        };

        const testJson = JSON.stringify(testLayout);
        const testSize = new Blob([testJson]).size;
        console.log(`🔍 Testing ${testCount} components (${testSize} bytes)`);

        try {
          const testResponse = await fetch(`http://${cleanIp}:3080/layout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: testJson,
          });

          if (testResponse.ok) {
            console.log(`✅ ${testCount} components: SUCCESS`);
            workingCount = testCount;
          } else {
            const errorText = await testResponse.text();
            console.log(`❌ ${testCount} components: FAILED - ${testResponse.status} ${errorText}`);
            failingCount = testCount;
          }
        } catch (testError) {
          console.log(`❌ ${testCount} components: ERROR - ${testError}`);
          failingCount = testCount;
        }
      }

      console.log(`🎯 Maximum working: ${workingCount} components, Breaks at: ${failingCount} components`);
      if (failingCount < totalComponents) {
        console.log('🚨 Breaking component:', layout.components?.[failingCount - 1]);
      }

      console.log('🎯 Progressive test completed, trying to fix and send full layout...');

      // First expand any slotList components into concrete components for the TV
      const expandedLayout = {
        ...layout,
        components: expandLayoutForExport(layout.components || [])
      };

      // Comprehensive JSON cleaning system to handle ALL Swift parsing issues
      const cleanLayoutForServer = (layoutToClean: any) => {
        return {
          name: layoutToClean.name || "basketball",
          components: (layoutToClean.components || []).map((component: any) => {
            // Start with only the essential fields Swift expects
            const cleanComponent: any = {
              id: component.id,
              type: component.type || "custom",
              position: {
                x: Number(component.position?.x || 0),
                y: Number(component.position?.y || 0)
              },
              size: {
                width: Number(component.size?.width || 100),
                height: Number(component.size?.height || 50)
              },
              props: {}
            };

            // Add optional fields only if they exist and are valid
            if (component.displayName && typeof component.displayName === 'string') {
              cleanComponent.displayName = component.displayName;
            }

            if (typeof component.layer === 'number') {
              cleanComponent.layer = component.layer;
            }

            if (typeof component.visible === 'boolean') {
              cleanComponent.visible = component.visible;
            }

            // Comprehensively clean props - merge from all possible sources
            const allProps = {
              ...component.props,
              // Move root-level team color fields into props
              ...(component.useTeamColor !== undefined && { useTeamColor: component.useTeamColor }),
              ...(component.teamColorSide !== undefined && { teamColorSide: component.teamColorSide })
            };

            // Clean and validate each prop
            Object.keys(allProps).forEach(key => {
              const value = allProps[key];

              // Skip undefined, null, or empty objects
              if (value === undefined || value === null) return;
              if (typeof value === 'object' && Object.keys(value).length === 0) return;

              // Convert problematic string values
              if (value === "none" && (key === 'dataPath' || key === 'imagePath')) {
                cleanComponent.props[key] = "";
                return;
              }

              if (value === "none" && key === 'objectFit') {
                cleanComponent.props[key] = "fill";
                return;
              }

              // Clean strings
              if (typeof value === 'string') {
                const cleaned = value.trim();
                if (cleaned.length > 0) {
                  cleanComponent.props[key] = cleaned;
                }
                return;
              }

              // Keep numbers and booleans as-is
              if (typeof value === 'number' || typeof value === 'boolean') {
                cleanComponent.props[key] = value;
                return;
              }

              // For objects, only include if they have content
              if (typeof value === 'object' && Object.keys(value).length > 0) {
                cleanComponent.props[key] = value;
              }
            });

            return cleanComponent;
          }),
          dimensions: {
            width: Number(layoutToClean.dimensions?.width || 1920),
            height: Number(layoutToClean.dimensions?.height || 1080)
          },
          backgroundColor: layoutToClean.backgroundColor || "#000000"
        };
      };

      const cleanedLayout = cleanLayoutForServer(expandedLayout);

      const cleanedJson = JSON.stringify(cleanedLayout);
      const cleanedSize = new Blob([cleanedJson]).size;
      console.log('🧹 Cleaned layout size:', cleanedSize, 'bytes');

      const response = await fetch(`http://${cleanIp}:3080/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: cleanedJson,
      });

      if (!response.ok) {
        // Try to get more details from the response
        let errorDetails = '';
        try {
          const responseText = await response.text();
          if (responseText) {
            errorDetails = ` - ${responseText}`;
          }
        } catch (e) {
          // Ignore if we can't read response
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetails}`);
      }

      console.log('✅ Layout sent successfully to TV');
      alert('Layout sent successfully to TV!');
    } catch (error) {
      console.error('Error sending layout to TV:', error);

      // Check if this is a network restriction error (common in Brave browser)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_ADDRESS_UNREACHABLE')) {
        alert(`Failed to send layout to TV: Network blocked by browser.\n\nIf you're using Brave browser:\n1. Click the Brave shield icon in the address bar\n2. Turn off "Block fingerprinting"\n3. Reload the page and try again\n\nOr try using Chrome/Safari instead.`);
      } else {
        alert(`Failed to send layout to TV: ${errorMessage}`);
      }
    } finally {
      setIsSendingToTv(false);
    }
  }, [layout, tvIpAddress]);

  // Quick save preset function
  const quickSavePreset = useCallback(() => {
    const PRESETS_STORAGE_KEY = 'scoreboard-layout-presets';
    const nameToUse = layout.name || 'Untitled Layout';
    
    // Get existing presets
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    const savedPresets = saved ? JSON.parse(saved) : [];
    
    const newPreset = {
      id: `preset_${Date.now()}`,
      name: nameToUse,
      layout: { ...layout },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if preset with same name exists
    const existingIndex = savedPresets.findIndex((p: any) => p.name === newPreset.name);
    let updatedPresets;

    if (existingIndex >= 0) {
      // Update existing preset
      updatedPresets = [...savedPresets];
      updatedPresets[existingIndex] = { 
        ...newPreset, 
        id: savedPresets[existingIndex].id, 
        createdAt: savedPresets[existingIndex].createdAt 
      };
    } else {
      // Add new preset
      updatedPresets = [...savedPresets, newPreset];
    }

    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
    
    // Show brief feedback
    const action = existingIndex >= 0 ? 'updated' : 'saved';
    alert(`Preset "${nameToUse}" ${action} successfully!`);
  }, [layout]);

  // LocalStorage keys to export/import
  const LOCAL_STORAGE_KEYS = [
    'sv-slot-templates',
    'sv-component-templates',
    'canvas-background-image',
    'canvas-background-visible',
    'scoreboard-layout-presets'
  ];

  // Export all localStorage data
  const exportLocalStorage = useCallback(() => {
    const exportData: Record<string, string | null> = {};
    LOCAL_STORAGE_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        exportData[key] = value;
      }
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-builder-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Import localStorage data from file
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
          let importedCount = 0;

          Object.entries(data).forEach(([key, value]) => {
            if (LOCAL_STORAGE_KEYS.includes(key) && typeof value === 'string') {
              localStorage.setItem(key, value);
              importedCount++;
            }
          });

          alert(`Imported ${importedCount} settings. Refreshing page to apply changes...`);
          window.location.reload();
        } catch (error) {
          alert('Failed to import data: Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // Listen for canvas undo/redo events
  React.useEffect(() => {
    const handleCanvasUndo = () => {
      undo();
    };
    
    const handleCanvasRedo = () => {
      redo();
    };
    
    window.addEventListener('canvas-undo', handleCanvasUndo);
    window.addEventListener('canvas-redo', handleCanvasRedo);
    return () => {
      window.removeEventListener('canvas-undo', handleCanvasUndo);
      window.removeEventListener('canvas-redo', handleCanvasRedo);
    };
  }, [undo, redo]);

  const addComponent = useCallback((
    type: ComponentConfig['type'],
    customPosition?: { x: number, y: number },
    customSize?: { width: number, height: number },
    customProps?: Record<string, any>,
    customDisplayName?: string,
    parentId?: string,
    customId?: string,
    customLayer?: number,
    extraProps?: Partial<ComponentConfig> // Additional properties like originalSize, originalAspectRatio, etc.
  ) => {
    setLayout(prev => {
      // Save current state for undo
      saveStateForUndo('ADD_COMPONENT', `Add ${type} component`, prev);

      const componentId = customId || generateComponentId(type);

      // Generate unique display name
      const baseName = customDisplayName || getDefaultDisplayName(type);
      const existingNames = new Set(
        (prev.components || [])
          .map(c => c.displayName || c.type)
          .filter(Boolean)
      );

      let uniqueName = baseName;
      if (existingNames.has(uniqueName)) {
        // Try baseName2, baseName3, etc.
        let counter = 2;
        while (existingNames.has(`${baseName}${counter}`)) {
          counter++;
        }
        uniqueName = `${baseName}${counter}`;
      }

      // Calculate highest layer among root components (no parent) to place new component on top
      const rootComponents = (prev.components || []).filter(c => !c.parentId);
      const maxRootLayer = rootComponents.reduce((max, comp) => Math.max(max, comp.layer || 0), -1);

      const newComponent: ComponentConfig = {
        id: componentId,
        displayName: uniqueName,
        type,
        position: customPosition || { x: 192, y: 108 }, // 192px from left, 108px from top
        size: customSize || getDefaultSize(type),
        layer: customLayer !== undefined ? customLayer : maxRootLayer + 1,
        props: customProps || getDefaultProps(type),
        team: needsTeam(type) ? 'home' : undefined,
        parentId,
        // Merge in extra properties (originalSize, originalAspectRatio, scaleAnchor, visible, etc.)
        ...extraProps
      };

      return {
        ...prev,
        components: [...(prev.components || []), newComponent]
      };
    });
  }, [saveStateForUndo, generateComponentId]);

  // Add a ref to track if we're currently dragging to batch position updates
  const isDraggingRef = React.useRef(false);
  const dragStartStateRef = React.useRef<LayoutConfig | null>(null);

  const updateComponent = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    // Round position and size values to integers to prevent sub-pixel rendering differences
    // between web (CSS) and React Native (tvOS)
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

    setLayout(prev => {
      const component = (prev.components || []).find(c => c.id === id);
      if (component) {
        // Check if this is a position/size update (drag/resize operation)
        const isPropertyUpdate = Object.keys(roundedUpdates).some(key => !['position', 'size'].includes(key));

        if (isPropertyUpdate) {
          // Property updates always save undo state
          saveStateForUndo('UPDATE_COMPONENT', `Update ${component.type} properties`, prev);
        }
      }

      return {
        ...prev,
        components: (prev.components || []).map(comp =>
          comp.id === id ? { ...comp, ...roundedUpdates } : comp
        )
      };
    });
  }, [saveStateForUndo]);

  // Function to start a drag operation (save initial state) - optimized
  const startDragOperation = useCallback(() => {
    if (!isDraggingRef.current) {
      // Use functional update to access current layout without dependency
      setLayout(currentLayout => {
        dragStartStateRef.current = structuredClone(currentLayout); // More efficient cloning
        isDraggingRef.current = true;
        return currentLayout; // Return unchanged
      });
    }
  }, []);

  // Function to end a drag operation (save final state for undo)
  const endDragOperation = useCallback((description: string) => {
    if (isDraggingRef.current && dragStartStateRef.current) {
      saveStateForUndo('UPDATE_COMPONENT', description, dragStartStateRef.current);
      isDraggingRef.current = false;
      dragStartStateRef.current = null;
    }
  }, [saveStateForUndo]);

  const deleteComponent = useCallback((id: string) => {
    setLayout(prev => {
      const component = (prev.components || []).find(c => c.id === id);
      if (component) {
        saveStateForUndo('DELETE_COMPONENT', `Delete ${component.type} component`, prev);
      }
      
      setSelectedComponents(prevSelected => prevSelected.filter(compId => compId !== id));
      
      return {
        ...prev,
        components: (prev.components || []).filter(comp => comp.id !== id)
      };
    });
  }, [saveStateForUndo]);

  const duplicateComponent = useCallback((id: string) => {
    setLayout(prev => {
      const original = (prev.components || []).find(comp => comp.id === id);
      if (original) {
        saveStateForUndo('DUPLICATE_COMPONENT', `Duplicate ${original.type} component`, prev);

        const duplicateId = generateComponentId(original.type);

        // Generate unique display name
        const baseName = original.displayName || original.type;
        const existingNames = new Set(
          (prev.components || [])
            .map(c => c.displayName || c.type)
            .filter(Boolean)
        );

        let uniqueName = baseName;
        if (existingNames.has(uniqueName)) {
          // Try baseName2, baseName3, etc.
          let counter = 2;
          while (existingNames.has(`${baseName}${counter}`)) {
            counter++;
          }
          uniqueName = `${baseName}${counter}`;
        }

        const duplicate: ComponentConfig = {
          ...original,
          id: duplicateId,
          displayName: uniqueName,
          position: {
            x: original.position.x, // Exact same position (no offset, no grid snap)
            y: original.position.y
          }
        };

        // Auto-select the newly duplicated component
        setTimeout(() => setSelectedComponents([duplicateId]), 0);

        return {
          ...prev,
          components: [...(prev.components || []), duplicate]
        };
      }
      return prev;
    });
  }, [saveStateForUndo, generateComponentId]);

  // Duplicate multiple components for copy-drag operation (returns map of old ID to new ID)
  const copyDragComponents = useCallback((ids: string[]): Map<string, string> => {
    const idMapping = new Map<string, string>();

    setLayout(prev => {
      const components = prev.components || [];

      // Helper to get all descendants of a component
      const getDescendants = (parentId: string): ComponentConfig[] => {
        const children = components.filter(c => c.parentId === parentId);
        const descendants: ComponentConfig[] = [];
        for (const child of children) {
          descendants.push(child);
          descendants.push(...getDescendants(child.id));
        }
        return descendants;
      };

      // Helper to check if a component is a descendant of another
      const isDescendantOf = (componentId: string, potentialAncestorId: string): boolean => {
        const component = components.find(c => c.id === componentId);
        if (!component || !component.parentId) return false;
        if (component.parentId === potentialAncestorId) return true;
        return isDescendantOf(component.parentId, potentialAncestorId);
      };

      // Filter out selected components that are already descendants of other selected components
      const rootSelectedIds = ids.filter(id => {
        return !ids.some(otherId => otherId !== id && isDescendantOf(id, otherId));
      });

      // Collect all components to copy (root selected + their descendants)
      const componentsToCopy: ComponentConfig[] = [];
      const addedIds = new Set<string>();

      for (const id of rootSelectedIds) {
        const component = components.find(c => c.id === id);
        if (component && !addedIds.has(id)) {
          componentsToCopy.push(component);
          addedIds.add(id);

          const descendants = getDescendants(id);
          for (const desc of descendants) {
            if (!addedIds.has(desc.id)) {
              componentsToCopy.push(desc);
              addedIds.add(desc.id);
            }
          }
        }
      }

      if (componentsToCopy.length === 0) return prev;

      saveStateForUndo('COPY_DRAG', `Copy-drag ${componentsToCopy.length} component(s)`, prev);

      const existingNames = new Set(
        components.map(c => c.displayName || c.type).filter(Boolean)
      );

      // Generate new IDs for all components
      for (const comp of componentsToCopy) {
        idMapping.set(comp.id, generateComponentId(comp.type));
      }

      // Create new components with updated IDs and parent references
      const newComponents: ComponentConfig[] = componentsToCopy.map(comp => {
        const newId = idMapping.get(comp.id)!;
        const newParentId = comp.parentId ? idMapping.get(comp.parentId) : undefined;

        // Generate unique display name
        const baseName = comp.displayName || comp.type;
        let uniqueName = baseName;
        if (existingNames.has(uniqueName)) {
          let counter = 2;
          while (existingNames.has(`${baseName}${counter}`)) {
            counter++;
          }
          uniqueName = `${baseName}${counter}`;
        }
        existingNames.add(uniqueName);

        return {
          ...comp,
          id: newId,
          displayName: uniqueName,
          parentId: newParentId,
          position: { ...comp.position } // Same position
        };
      });

      // Select the new root components
      const newRootIds = rootSelectedIds.map(id => idMapping.get(id)!);
      setTimeout(() => setSelectedComponents(newRootIds), 0);

      return {
        ...prev,
        components: [...components, ...newComponents]
      };
    });

    return idMapping;
  }, [saveStateForUndo, generateComponentId]);

  // Copy selected components (and their children) to clipboard
  const copyComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    const components = layout.components || [];

    // Helper to get all descendants of a component
    const getDescendants = (parentId: string): ComponentConfig[] => {
      const children = components.filter(c => c.parentId === parentId);
      const descendants: ComponentConfig[] = [];
      for (const child of children) {
        descendants.push(child);
        descendants.push(...getDescendants(child.id));
      }
      return descendants;
    };

    // Helper to check if a component is a descendant of another
    const isDescendantOf = (componentId: string, potentialAncestorId: string): boolean => {
      const component = components.find(c => c.id === componentId);
      if (!component || !component.parentId) return false;
      if (component.parentId === potentialAncestorId) return true;
      return isDescendantOf(component.parentId, potentialAncestorId);
    };

    // Filter out selected components that are already descendants of other selected components
    // This prevents duplicates when both a parent and its child are selected
    const rootSelectedIds = selectedComponents.filter(id => {
      return !selectedComponents.some(otherId =>
        otherId !== id && isDescendantOf(id, otherId)
      );
    });

    // Collect all components to copy (root selected + their descendants)
    const componentsToCopy: ComponentConfig[] = [];
    const addedIds = new Set<string>();

    for (const id of rootSelectedIds) {
      const component = components.find(c => c.id === id);
      if (component && !addedIds.has(id)) {
        componentsToCopy.push(component);
        addedIds.add(id);

        // Add all descendants
        const descendants = getDescendants(id);
        for (const desc of descendants) {
          if (!addedIds.has(desc.id)) {
            componentsToCopy.push(desc);
            addedIds.add(desc.id);
          }
        }
      }
    }

    // Deep clone the components for clipboard
    setClipboard(structuredClone(componentsToCopy));
  }, [selectedComponents, layout.components]);

  // Paste components from clipboard
  const pasteComponents = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;

    setLayout(prev => {
      saveStateForUndo('DUPLICATE_COMPONENT', `Paste ${clipboard.length} component(s)`, prev);

      const existingNames = new Set(
        (prev.components || [])
          .map(c => c.displayName || c.type)
          .filter(Boolean)
      );

      // Create ID mapping for parent-child relationships
      const idMapping = new Map<string, string>();

      // Generate new IDs for all clipboard components
      for (const comp of clipboard) {
        idMapping.set(comp.id, generateComponentId(comp.type));
      }

      // Find which components in clipboard are "root" (their parent is not in clipboard)
      const clipboardIds = new Set(clipboard.map(c => c.id));
      const rootComponents = clipboard.filter(c => !c.parentId || !clipboardIds.has(c.parentId));

      // Create new components with updated IDs and positions
      const newComponents: ComponentConfig[] = clipboard.map(comp => {
        const newId = idMapping.get(comp.id)!;
        const newParentId = comp.parentId ? idMapping.get(comp.parentId) : undefined;

        // Generate unique display name
        const baseName = comp.displayName || comp.type;
        let uniqueName = baseName;
        if (existingNames.has(uniqueName)) {
          let counter = 2;
          while (existingNames.has(`${baseName}${counter}`)) {
            counter++;
          }
          uniqueName = `${baseName}${counter}`;
        }
        existingNames.add(uniqueName);

        // Keep position exactly the same (no offset, no grid snap)
        const position = { ...comp.position };

        return {
          ...comp,
          id: newId,
          displayName: uniqueName,
          parentId: newParentId,
          position
        };
      });

      // Select the newly pasted root components
      const newRootIds = rootComponents.map(r => idMapping.get(r.id)!);
      setTimeout(() => setSelectedComponents(newRootIds), 0);

      return {
        ...prev,
        components: [...(prev.components || []), ...newComponents]
      };
    });
  }, [clipboard, saveStateForUndo, generateComponentId]);

  // Group selected components together
  const groupSelectedComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    setLayout(prev => {
      const components = prev.components || [];
      const selectedComps = components.filter(c => selectedComponents.includes(c.id));

      if (selectedComps.length === 0) return prev;

      saveStateForUndo('GROUP_COMPONENTS', `Group ${selectedComps.length} components`, prev);

      // Calculate bounding box of selected components
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedComps.forEach(c => {
        minX = Math.min(minX, c.position.x);
        minY = Math.min(minY, c.position.y);
        maxX = Math.max(maxX, c.position.x + c.size.width);
        maxY = Math.max(maxY, c.position.y + c.size.height);
      });

      // Generate group ID and name
      const groupId = generateComponentId('group');
      const existingNames = new Set(components.map(c => c.displayName || c.type).filter(Boolean));
      let groupName = 'Group';
      if (existingNames.has(groupName)) {
        let counter = 2;
        while (existingNames.has(`Group${counter}`)) counter++;
        groupName = `Group${counter}`;
      }

      // Find the max layer among root components to place group on top
      const rootComponents = components.filter(c => !c.parentId);
      const maxLayer = rootComponents.reduce((max, c) => Math.max(max, c.layer || 0), -1);

      // Create the group component
      const groupComponent: ComponentConfig = {
        id: groupId,
        type: 'group',
        displayName: groupName,
        position: { x: Math.round(minX), y: Math.round(minY) },
        size: { width: Math.round(maxX - minX), height: Math.round(maxY - minY) },
        layer: maxLayer + 1
      };

      // Update selected components to be children of the group
      // Also store their relative position within the group
      const updatedComponents = components.map(c => {
        if (selectedComponents.includes(c.id)) {
          return {
            ...c,
            parentId: groupId,
            // Position is now relative to group (but we keep absolute for now)
          };
        }
        return c;
      });

      // Select the new group
      setTimeout(() => setSelectedComponents([groupId]), 0);

      return {
        ...prev,
        components: [...updatedComponents, groupComponent]
      };
    });
  }, [selectedComponents, saveStateForUndo, generateComponentId]);

  // Ungroup selected groups - move children to root level
  const ungroupSelectedComponents = useCallback(() => {
    if (selectedComponents.length === 0) return;

    setLayout(prev => {
      const components = prev.components || [];
      const selectedGroups = components.filter(
        c => selectedComponents.includes(c.id) && c.type === 'group'
      );

      if (selectedGroups.length === 0) return prev;

      saveStateForUndo('UNGROUP_COMPONENTS', `Ungroup ${selectedGroups.length} group(s)`, prev);

      const groupIds = new Set(selectedGroups.map(g => g.id));

      // Find all children of the selected groups
      const childrenIds: string[] = [];
      components.forEach(c => {
        if (c.parentId && groupIds.has(c.parentId)) {
          childrenIds.push(c.id);
        }
      });

      // Update children to remove parent reference (move to root)
      // and remove the group components
      const updatedComponents = components
        .filter(c => !groupIds.has(c.id)) // Remove group components
        .map(c => {
          if (c.parentId && groupIds.has(c.parentId)) {
            return { ...c, parentId: undefined };
          }
          return c;
        });

      // Select the former children
      setTimeout(() => setSelectedComponents(childrenIds), 0);

      return {
        ...prev,
        components: updatedComponents
      };
    });
  }, [selectedComponents, saveStateForUndo]);

  // Global keyboard handler for copy/paste/group
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedComponents.length > 0) {
          e.preventDefault();
          copyComponents();
        }
      }

      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard && clipboard.length > 0) {
          e.preventDefault();
          pasteComponents();
        }
      }

      // Group: Ctrl+G or Cmd+G
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        if (selectedComponents.length > 0) {
          e.preventDefault();
          groupSelectedComponents();
        }
      }

      // Ungroup: Ctrl+Shift+G or Cmd+Shift+G
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
    setLayout(prev => {
      saveStateForUndo('LOAD_PRESET', `Load custom preset "${customLayout.name}"`, prev);
      setSelectedComponents([]);
      return customLayout;
    });
  }, [saveStateForUndo]);

  // Handler to properly merge partial layout updates (used by Canvas for resolution changes)
  const handleUpdateLayout = useCallback((updates: Partial<LayoutConfig>) => {
    setLayout(prev => ({
      ...prev,
      ...updates,
      // Deep merge dimensions if provided
      dimensions: updates.dimensions ? { ...prev.dimensions, ...updates.dimensions } : prev.dimensions
    }));
  }, []);

  // Show fake 404 if not unlocked
  if (!isUnlocked) {
    return <Fake404Overlay onDismiss={handleUnlock} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        {/* Left: Branding & Layout Type */}
        <div className="header-section header-branding">
          <span className="header-title">Layout Builder</span>
          <div className="header-divider" />
          <select
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
            title="Select the layout type - this determines which layout template the TV app will use"
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
              title="Enter a custom layout type identifier for the TV app"
            />
          )}
        </div>

        {/* Center: Edit Operations */}
        <div className="header-section header-edit">
            <button
              onClick={undo}
              disabled={undoHistory.length === 0}
              className="header-btn header-btn-secondary"
              title={undoHistory.length > 0 ? `Undo: ${undoHistory[0].description}` : 'Nothing to undo'}
            >
              Undo {undoHistory.length > 0 && <span className="btn-badge">{undoHistory.length}</span>}
            </button>
            <button
              onClick={redo}
              disabled={redoHistory.length === 0}
              className="header-btn header-btn-secondary"
              title={redoHistory.length > 0 ? `Redo: ${redoHistory[0].description}` : 'Nothing to redo'}
            >
              Redo {redoHistory.length > 0 && <span className="btn-badge">{redoHistory.length}</span>}
            </button>
          </div>

        {/* Right: File & Export Operations */}
        <div className="header-section header-file">
            <button
              onClick={quickSavePreset}
              className="header-btn header-btn-primary"
              title="Quick save current layout as a preset with the current name"
            >
              Save
            </button>
            <button
              onClick={() => setShowPresetModal(true)}
              className="header-btn header-btn-secondary"
              title="Open preset manager to save, load, import, or export layout presets"
            >
              Presets
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="header-btn header-btn-accent"
              title="Export current layout as JSON file for use in the TV app"
            >
              Export
            </button>
            <span style={{ width: '1px', height: '20px', backgroundColor: '#444', margin: '0 4px' }} />
            <button
              onClick={exportLocalStorage}
              className="header-btn header-btn-secondary"
              title="Export all settings (templates, presets, preferences) to a file"
            >
              Backup
            </button>
            <button
              onClick={importLocalStorage}
              className="header-btn header-btn-secondary"
              title="Import settings from a backup file"
            >
              Restore
            </button>
          </div>
      </header>

      <div className="app-body">
            <div
              className={`panel-container left-panel ${isResizingLeft ? 'resizing' : ''}`}
              style={{ width: leftPanelWidth }}
            >
              <MemoizedLayerPanel
                layout={layout}
                selectedComponents={selectedComponents}
                onSelectComponents={setSelectedComponents}
                onUpdateComponent={updateComponent}
                onDeleteComponent={deleteComponent}
                onAddComponent={addComponent}
                onStartDragOperation={startDragOperation}
                onEndDragOperation={endDragOperation}
                onCopyComponents={copyComponents}
                onPasteComponents={pasteComponents}
                hasClipboard={clipboard !== null && clipboard.length > 0}
              />
              <div
                className="panel-resize-edge right-edge"
                onMouseDown={handleLeftResizeStart}
              />
            </div>

            <MemoizedCanvas
              layout={layout}
              selectedComponents={selectedComponents}
              onSelectComponents={setSelectedComponents}
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
            />

            <div
              className={`panel-container right-panel ${isResizingRight ? 'resizing' : ''}`}
              style={{ width: rightPanelWidth }}
            >
              <div
                className="panel-resize-edge left-edge"
                onMouseDown={handleRightResizeStart}
              />
              <MemoizedPropertyPanel
                layout={layout}
                selectedComponents={selectedComponents}
                onUpdateComponent={updateComponent}
                onUpdateLayout={handleUpdateLayout}
                gameData={gameData}
                onUpdateGameData={setGameData}
                panelWidth={rightPanelWidth}
              />
            </div>
      </div>

      {showExportModal && (
        <MemoizedExportModal
          layout={layout}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showPresetModal && (
        <MemoizedPresetModal
          layout={layout}
          onClose={() => setShowPresetModal(false)}
          onLoadPreset={loadCustomPreset}
        />
      )}
    </div>
  );
}

function getDefaultSize(type: ComponentConfig['type']) {
  // Return pixel-based sizes for 1920x1080 base resolution
  const sizes = {
    teamName: { width: 480, height: 130 },  // 480px width, 130px height
    score: { width: 288, height: 194 },     // 288px width, 194px height
    clock: { width: 384, height: 162 },     // 384px width, 162px height
    period: { width: 230, height: 162 },    // 230px width, 162px height
    fouls: { width: 192, height: 130 },     // 192px width, 130px height
    timeouts: { width: 384, height: 86 },   // 384px width, 86px height
    bonus: { width: 154, height: 130 },     // 154px width, 130px height
    custom: { width: 192, height: 108 },    // 192px width, 108px height
    dynamicList: { width: 300, height: 60 }, // 300px width, 60px height
    leaderboardList: { width: 300, height: 340 } // 300px width, 340px height
  };
  return sizes[type] || { width: 192, height: 108 };
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
  };
  return props[type] || {};
}

function getDefaultDisplayName(type: ComponentConfig['type']) {
  // Return "Layer" for group type, otherwise return the type
  if (type === 'group') return 'Layer';
  return type;
}

function needsTeam(type: ComponentConfig['type']): boolean {
  return ['teamName', 'score', 'fouls', 'timeouts', 'bonus'].includes(type);
}

export default App;