import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ComponentConfig, LayoutConfig, LAYOUT_TYPES } from './types';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import LayerPanel from './components/LayerPanel';
import ExportModal from './components/ExportModal';
import PresetModal from './components/PresetModal';
import { tvDiscoveryService, DiscoveredTV } from './services/tvDiscovery';
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
    home_team_color: '#c41e3a',
    away_team_color: '#003f7f'
  });

  // Remove expensive console.log - causes performance issues

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<ComponentConfig | null>(null);
  
  // Undo/Redo system - keep track of last 50 actions each
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);
  
  // Component naming counter system
  
  // TV endpoint controls
  const [tvIpAddress, setTvIpAddress] = useState('192.168.1.100'); // Default IP
  const [isSendingToTv, setIsSendingToTv] = useState(false);
  const [discoveredTVs, setDiscoveredTVs] = useState<DiscoveredTV[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedTvOption, setSelectedTvOption] = useState('custom');

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

      // Comprehensive JSON cleaning system to handle ALL Swift parsing issues
      const cleanLayoutForServer = (layout: any) => {
        return {
          name: layout.name || "basketball",
          components: (layout.components || []).map((component: any) => {
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
            width: Number(layout.dimensions?.width || 1920),
            height: Number(layout.dimensions?.height || 1080)
          },
          backgroundColor: layout.backgroundColor || "#000000"
        };
      };

      const cleanedLayout = cleanLayoutForServer(layout);

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

  // TV Discovery functions
  const scanForTVs = useCallback(async () => {
    setIsScanning(true);
    try {
      const tvs = await tvDiscoveryService.discoverTVs();
      setDiscoveredTVs(tvs);
    } catch (error) {
      console.error('Failed to scan for TVs:', error);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleTvSelectionChange = useCallback((value: string) => {
    setSelectedTvOption(value);
    
    if (value !== 'custom') {
      // Find the selected TV and set its IP
      const selectedTV = discoveredTVs.find(tv => `${tv.ip}:${tv.port}` === value);
      if (selectedTV) {
        setTvIpAddress(selectedTV.ip);
      }
    }
  }, [discoveredTVs]);

  // Auto-scan for TVs when component mounts
  useEffect(() => {
    // Subscribe to auto-selection of first discovered TV
    const handleAutoSelect = (tv: DiscoveredTV) => {
      setSelectedTvOption(`${tv.ip}:${tv.port}`);
      setTvIpAddress(tv.ip);
      console.log(`🎯 Auto-selected TV: ${tv.name} (${tv.ip})`);
    };

    const setupTVDiscovery = () => {
      // Subscribe to TV discovery updates
      tvDiscoveryService.subscribe(setDiscoveredTVs);
      tvDiscoveryService.onAutoSelect(handleAutoSelect);
      
      // Make tvDiscoveryService available globally for manual TV addition
      (window as any).addTV = (ip: string, name?: string) => {
        tvDiscoveryService.addManualTV(name || `TV (${ip})`, ip);
        console.log(`📺 Added TV at ${ip} to discovery list`);
      };
      
      // Initial scan after a short delay
      setTimeout(() => {
        scanForTVs();
      }, 1000);
    };

    setupTVDiscovery();

    return () => {
      tvDiscoveryService.unsubscribe(setDiscoveredTVs);
      tvDiscoveryService.offAutoSelect(handleAutoSelect);
      delete (window as any).addTV;
    };
  }, [scanForTVs]);

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

  // Memoize highest layer calculation to avoid recomputing on every render
  const highestLayer = useMemo(() => 
    (layout.components || []).reduce((max, comp) => Math.max(max, comp.layer || 0), 0)
  , [layout.components]);

  const addComponent = useCallback((
    type: ComponentConfig['type'],
    customPosition?: { x: number, y: number },
    customSize?: { width: number, height: number },
    customProps?: Record<string, any>,
    customDisplayName?: string
  ) => {
    setLayout(prev => {
      // Save current state for undo
      saveStateForUndo('ADD_COMPONENT', `Add ${type} component`, prev);

      const componentId = generateComponentId(type);

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

      const newComponent: ComponentConfig = {
        id: componentId,
        displayName: uniqueName,
        type,
        position: customPosition || { x: 192, y: 108 }, // 192px from left, 108px from top
        size: customSize || getDefaultSize(type),
        layer: 0,
        props: customProps || getDefaultProps(type),
        team: needsTeam(type) ? 'home' : undefined
      };

      return {
        ...prev,
        components: [...(prev.components || []), newComponent]
      };
    });
  }, [highestLayer, saveStateForUndo, generateComponentId]);

  // Add a ref to track if we're currently dragging to batch position updates
  const isDraggingRef = React.useRef(false);
  const dragStartStateRef = React.useRef<LayoutConfig | null>(null);

  const updateComponent = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    // Removed expensive console.log with stack trace - major performance issue
    setLayout(prev => {
      const component = (prev.components || []).find(c => c.id === id);
      if (component) {
        // Check if this is a position/size update (drag/resize operation)
        const isPropertyUpdate = Object.keys(updates).some(key => !['position', 'size'].includes(key));
        
        if (isPropertyUpdate) {
          // Property updates always save undo state
          saveStateForUndo('UPDATE_COMPONENT', `Update ${component.type} properties`, prev);
        }
      }
      
      return {
        ...prev,
        components: (prev.components || []).map(comp => 
          comp.id === id ? { ...comp, ...updates } : comp
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
            x: original.position.x + 40, // 40px offset
            y: original.position.y + 40  // 40px offset
          }
        };

        return {
          ...prev,
          components: [...(prev.components || []), duplicate]
        };
      }
      return prev;
    });
  }, [saveStateForUndo, generateComponentId]);



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
          <h1>Layout Builder</h1>
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
        </div>

        {/* DEBUG: TV Controls - Commented out for production */}
        {/*
        <div className="header-section header-tv">
          <div className="header-divider" />
          <select
            value={selectedTvOption}
            onChange={(e) => handleTvSelectionChange(e.target.value)}
            className="header-select"
            title="Select a discovered TV or enter a custom IP address"
          >
            <option key="custom-ip" value="custom">Custom IP</option>
            {discoveredTVs.map((tv) => (
              <option key={tv.id} value={`${tv.ip}:${tv.port}`}>
                {tv.name}
              </option>
            ))}
          </select>
          {selectedTvOption === 'custom' && (
            <input
              type="text"
              value={tvIpAddress}
              onChange={(e) => setTvIpAddress(e.target.value)}
              placeholder="192.168.1.100"
              className="header-input"
              title="Enter the IP address of the TV to send the layout to"
            />
          )}
          <button
            onClick={scanForTVs}
            disabled={isScanning}
            className="header-btn header-btn-icon"
            title="Scan local network for ScoreVision TV displays"
          >
            {isScanning ? '🔄' : '🔍'}
          </button>
          <button
            onClick={sendLayoutToTv}
            disabled={isSendingToTv}
            className="header-btn header-btn-warning"
            title="Send current layout directly to the selected TV for live preview"
          >
            {isSendingToTv ? 'Sending...' : '📺 Send to TV'}
          </button>
        </div>
        */}
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
            onAddComponent={addComponent}
            onStartDragOperation={startDragOperation}
            onEndDragOperation={endDragOperation}
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
    dynamicList: { width: 300, height: 60 } // 300px width, 60px height
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
      backgroundColor: '#9B59B6',
      textColor: '#ffffff',
      textAlign: 'center',
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
    }
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