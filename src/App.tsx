import React, { useState, useCallback, useMemo, useReducer } from 'react';
import { ComponentConfig, LayoutConfig } from './types';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import LayerPanel from './components/LayerPanel';
import ExportModal from './components/ExportModal';
import PresetModal from './components/PresetModal';
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
      position: { x: 96, y: 54 },        // 96px x, 54px y
      size: { width: 768, height: 162 },  // 768px width, 162px height
      props: { fontSize: 24 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 1056, y: 54 },       // 1056px x, 54px y
      size: { width: 768, height: 162 },  // 768px width, 162px height
      props: { fontSize: 24 },
      id: 'away_team_name'
    },
    {
      type: 'score' as const,
      team: 'home' as const,
      position: { x: 192, y: 270 },       // 192px x, 270px y
      size: { width: 576, height: 270 },  // 576px width, 270px height
      props: { fontSize: 48 },
      id: 'home_score'
    },
    {
      type: 'score' as const,
      team: 'away' as const,
      position: { x: 1152, y: 270 },      // 1152px x, 270px y
      size: { width: 576, height: 270 },  // 576px width, 270px height
      props: { fontSize: 48 },
      id: 'away_score'
    },
    {
      type: 'clock' as const,
      position: { x: 672, y: 648 },       // 672px x, 648px y
      size: { width: 576, height: 216 },  // 576px width, 216px height
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
      position: { x: 96, y: 108 },        // 96px x, 108px y
      size: { width: 768, height: 162 },  // 768px width, 162px height
      props: { fontSize: 24 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 1056, y: 108 },      // 1056px x, 108px y
      size: { width: 768, height: 162 },  // 768px width, 162px height
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
      position: { x: 96, y: 162 },        // 96px x, 162px y
      size: { width: 672, height: 194 },  // 672px width, 194px height
      props: { fontSize: 28 },
      id: 'home_team_name'
    },
    {
      type: 'teamName' as const,
      team: 'away' as const,
      position: { x: 1152, y: 162 },      // 1152px x, 162px y
      size: { width: 672, height: 194 },  // 672px width, 194px height
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
const MemoizedPresetModal = React.memo(PresetModal);

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
  const [showPresetModal, setShowPresetModal] = useState(false);
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
        position: customPosition || { x: 192, y: 108 }, // 192px from left, 108px from top
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
            x: original.position.x + 40, // 40px offset
            y: original.position.y + 40  // 40px offset
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

  const loadCustomPreset = useCallback((customLayout: LayoutConfig) => {
    setLayout(prev => {
      saveStateForUndo('LOAD_PRESET', `Load custom preset "${customLayout.name}"`, prev);
      setSelectedComponents([]);
      return customLayout;
    });
  }, [saveStateForUndo]);

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
          <button
            onClick={() => setShowPresetModal(true)}
            className="preset-button"
          >
            Manage Presets
          </button>
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
    custom: { width: 192, height: 108 }     // 192px width, 108px height
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