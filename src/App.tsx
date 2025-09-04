import React, { useState, useCallback, useMemo, useReducer } from 'react';
import { ComponentConfig, LayoutConfig } from './types';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import LayerPanel from './components/LayerPanel';
import ExportModal from './components/ExportModal';
// Import from shared layouts - for now we'll define them locally until we can resolve the path
const basketballLayout = {
  name: 'Basketball Standard',
  sport: 'basketball',
  backgroundColor: '#000000',
  dimensions: { width: 1920, height: 1080 },
  components: [
    {
      type: 'teamName' as const,
      team: 'home' as const,
      position: { x: 5, y: 5 },
      size: { width: 40, height: 15 },
      props: { fontSize: 24 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 55, y: 5 },
      size: { width: 40, height: 15 },
      props: { fontSize: 24 },
      id: 'away_team_name'
    },
    {
      type: 'score' as const,
      team: 'home' as const,
      position: { x: 10, y: 25 },
      size: { width: 30, height: 25 },
      props: { fontSize: 48 },
      id: 'home_score'
    },
    {
      type: 'score' as const,
      team: 'away' as const,
      position: { x: 60, y: 25 },
      size: { width: 30, height: 25 },
      props: { fontSize: 48 },
      id: 'away_score'
    },
    {
      type: 'clock' as const,
      position: { x: 35, y: 60 },
      size: { width: 30, height: 20 },
      props: { fontSize: 32 },
      id: 'game_clock'
    }
  ]
};

const volleyballLayout = {
  name: 'Volleyball Standard',
  sport: 'volleyball', 
  backgroundColor: '#000000',
  dimensions: { width: 1920, height: 1080 },
  components: [
    {
      type: 'teamName' as const,
      team: 'home' as const,
      position: { x: 5, y: 10 },
      size: { width: 40, height: 15 },
      props: { fontSize: 24 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 55, y: 10 },
      size: { width: 40, height: 15 },
      props: { fontSize: 24 },
      id: 'away_team_name'
    }
  ]
};

const soccerLayout = {
  name: 'Soccer Standard',
  sport: 'soccer',
  backgroundColor: '#000000',
  dimensions: { width: 1920, height: 1080 },
  components: [
    {
      type: 'teamName' as const,
      team: 'home' as const,
      position: { x: 5, y: 15 },
      size: { width: 35, height: 18 },
      props: { fontSize: 28 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 60, y: 15 },
      size: { width: 35, height: 18 },
      props: { fontSize: 28 },
      id: 'away_team_name'
    }
  ]
};
import './App.css';

// TV screen dimensions (16:9 aspect ratio) - Memoized to prevent object recreation
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

function App() {
  const [layout, setLayout] = useState<LayoutConfig>({
    name: 'New Layout',
    sport: 'basketball',
    components: [],
    backgroundColor: '#000000',
    dimensions: DEFAULT_DIMENSIONS
  });

  // Remove expensive console.log - causes performance issues

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<ComponentConfig | null>(null);
  
  // Undo/Redo system - keep track of last 5 actions each
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);

  // Save state for undo - optimized to avoid deep cloning
  const saveStateForUndo = useCallback((actionType: UndoAction['type'], description: string, currentLayout: LayoutConfig) => {
    setUndoHistory(prev => {
      const newAction: UndoAction = {
        type: actionType,
        description,
        previousLayout: structuredClone(currentLayout) // More efficient than JSON parse/stringify
      };
      
      // Keep only last 5 actions
      const newHistory = [newAction, ...prev].slice(0, 5);
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
        
        setRedoHistory(prevRedo => [currentRedoAction, ...prevRedo].slice(0, 5)); // Keep last 5 redo actions
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
        
        setUndoHistory(prevUndo => [currentUndoAction, ...prevUndo].slice(0, 5)); // Keep last 5 undo actions
        setSelectedComponents([]); // Clear selection after redo
        return lastRedoAction.previousLayout;
      });
      
      return remainingRedoHistory;
    });
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

  // Memoize highest layer calculation to avoid recomputing on every render
  const highestLayer = useMemo(() => 
    layout.components.reduce((max, comp) => Math.max(max, comp.layer || 0), 0)
  , [layout.components]);

  const addComponent = useCallback((type: ComponentConfig['type'], customPosition?: { x: number, y: number }, customSize?: { width: number, height: number }) => {
    setLayout(prev => {
      // Save current state for undo
      saveStateForUndo('ADD_COMPONENT', `Add ${type} component`, prev);
      
      const newComponent: ComponentConfig = {
        id: `${type}_${Date.now()}`,
        type,
        position: customPosition || { x: 10, y: 10 }, // 10% from left, 10% from top
        size: customSize || getDefaultSize(type),
        layer: highestLayer + 1,
        props: getDefaultProps(type),
        team: needsTeam(type) ? 'home' : undefined
      };

      return {
        ...prev,
        components: [...prev.components, newComponent]
      };
    });
  }, [highestLayer, saveStateForUndo]);

  // Add a ref to track if we're currently dragging to batch position updates
  const isDraggingRef = React.useRef(false);
  const dragStartStateRef = React.useRef<LayoutConfig | null>(null);

  const updateComponent = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    // Removed expensive console.log with stack trace - major performance issue
    setLayout(prev => {
      const component = prev.components.find(c => c.id === id);
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
        components: prev.components.map(comp => 
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
      const component = prev.components.find(c => c.id === id);
      if (component) {
        saveStateForUndo('DELETE_COMPONENT', `Delete ${component.type} component`, prev);
      }
      
      setSelectedComponents(prevSelected => prevSelected.filter(compId => compId !== id));
      
      return {
        ...prev,
        components: prev.components.filter(comp => comp.id !== id)
      };
    });
  }, [saveStateForUndo]);

  const duplicateComponent = useCallback((id: string) => {
    setLayout(prev => {
      const original = prev.components.find(comp => comp.id === id);
      if (original) {
        saveStateForUndo('DUPLICATE_COMPONENT', `Duplicate ${original.type} component`, prev);
        
        const duplicate: ComponentConfig = {
          ...original,
          id: `${original.type}_${Date.now()}`,
          position: {
            x: original.position.x + 2, // 2% offset
            y: original.position.y + 2  // 2% offset
          }
        };
        
        return {
          ...prev,
          components: [...prev.components, duplicate]
        };
      }
      return prev;
    });
  }, [saveStateForUndo]);

  // Memoize preset mappings to avoid recreation
  const presetMappings = useMemo(() => ({
    'basketball': basketballLayout,
    'volleyball': volleyballLayout,
    'soccer': soccerLayout
  }), []);

  const loadPresetLayout = useCallback((presetName: string) => {
    setLayout(prev => {
      saveStateForUndo('LOAD_PRESET', `Load ${presetName} preset`, prev);
      
      const preset = presetMappings[presetName as keyof typeof presetMappings];
      if (preset) {
        setSelectedComponents([]);
        return preset;
      }
      return prev;
    });
  }, [presetMappings, saveStateForUndo]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Scoreboard Layout Builder</h1>
          <input
            type="text"
            value={layout.name}
            onChange={(e) => setLayout(prev => ({ ...prev, name: e.target.value }))}
            className="layout-name-input"
            placeholder="Layout Name"
          />
        </div>
        <div className="header-right">
          <button
            onClick={undo}
            disabled={undoHistory.length === 0}
            className="undo-button"
            title={undoHistory.length > 0 ? `Undo: ${undoHistory[0].description}` : 'No actions to undo'}
          >
            ↶ Undo {undoHistory.length > 0 && `(${undoHistory.length})`}
          </button>
          <button
            onClick={redo}
            disabled={redoHistory.length === 0}
            className="redo-button"
            title={redoHistory.length > 0 ? `Redo: ${redoHistory[0].description}` : 'No actions to redo'}
          >
            ↷ Redo {redoHistory.length > 0 && `(${redoHistory.length})`}
          </button>
          <select
            onChange={(e) => {
              if (e.target.value) {
                loadPresetLayout(e.target.value);
                e.target.value = ''; // Reset selection
              }
            }}
            className="sport-select"
          >
            <option value="">Load Preset Layout...</option>
            <option value="basketball">Basketball Standard</option>
            <option value="volleyball">Volleyball Standard</option>
            <option value="soccer">Soccer Standard</option>
          </select>
          <select
            value={layout.sport}
            onChange={(e) => setLayout(prev => ({ ...prev, sport: e.target.value }))}
            className="sport-select"
          >
            <option value="basketball">Basketball</option>
            <option value="volleyball">Volleyball</option>
            <option value="soccer">Soccer</option>
            <option value="football">Football</option>
            <option value="hockey">Hockey</option>
            <option value="custom">Custom Sport</option>
          </select>
          <select
            value={Object.keys(DEVICE_PRESETS).find(key => 
              DEVICE_PRESETS[key as keyof typeof DEVICE_PRESETS].width === layout.dimensions.width && 
              DEVICE_PRESETS[key as keyof typeof DEVICE_PRESETS].height === layout.dimensions.height
            ) || 'Custom 16:9'}
            onChange={(e) => setLayout(prev => ({ 
              ...prev, 
              dimensions: DEVICE_PRESETS[e.target.value as keyof typeof DEVICE_PRESETS]
            }))}
            className="device-select"
          >
            {Object.keys(DEVICE_PRESETS).map(preset => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
          <button
            onClick={() => setShowExportModal(true)}
            className="export-button"
          >
            Export Layout
          </button>
        </div>
      </header>

      <div className="app-body">
        <MemoizedLayerPanel
          layout={layout}
          selectedComponents={selectedComponents}
          onSelectComponents={setSelectedComponents}
          onUpdateComponent={updateComponent}
        />
        
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
        />
        
        <MemoizedPropertyPanel
          layout={layout}
          selectedComponents={selectedComponents}
          onUpdateComponent={updateComponent}
          onUpdateLayout={setLayout}
        />
      </div>

      {showExportModal && (
        <MemoizedExportModal
          layout={layout}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

function getDefaultSize(type: ComponentConfig['type']) {
  // Return percentage-based sizes (0-100% of canvas width/height)
  const sizes = {
    teamName: { width: 25, height: 12 }, // 25% width, 12% height
    score: { width: 15, height: 18 },    // 15% width, 18% height
    clock: { width: 20, height: 15 },    // 20% width, 15% height
    period: { width: 12, height: 15 },   // 12% width, 15% height
    fouls: { width: 10, height: 12 },    // 10% width, 12% height
    timeouts: { width: 20, height: 8 },  // 20% width, 8% height
    bonus: { width: 8, height: 12 },     // 8% width, 12% height
    custom: { width: 10, height: 10 }    // 10% width, 10% height
  };
  return sizes[type] || { width: 10, height: 10 };
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
      dataPath: '',
      label: '',
      fontSize: 24,
      format: 'text',
      prefix: '',
      suffix: '',
      backgroundColor: '#000000',
      textColor: '#ffffff',
      textAlign: 'center',
      borderWidth: 0,
      borderColor: '#ffffff',
      borderStyle: 'solid',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0
    }
  };
  return props[type] || {};
}

function needsTeam(type: ComponentConfig['type']): boolean {
  return ['teamName', 'score', 'fouls', 'timeouts', 'bonus'].includes(type);
}

export default App;