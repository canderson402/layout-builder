import React, { useState, useCallback } from 'react';
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

// TV screen dimensions (16:9 aspect ratio)
const DEVICE_PRESETS = {
  '1080p TV (1920x1080)': { width: 1920, height: 1080 },
  '4K TV (3840x2160)': { width: 1920, height: 1080 }, // Scaled down for display
  'HD TV (1280x720)': { width: 1280, height: 720 },
  'Custom 16:9': { width: 1600, height: 900 }
};

// Undo action types
type UndoAction = {
  type: 'UPDATE_LAYOUT' | 'ADD_COMPONENT' | 'UPDATE_COMPONENT' | 'DELETE_COMPONENT' | 'DUPLICATE_COMPONENT' | 'LOAD_PRESET';
  description: string;
  previousLayout: LayoutConfig;
};

function App() {
  const [layout, setLayout] = useState<LayoutConfig>({
    name: 'New Layout',
    sport: 'basketball',
    components: [],
    backgroundColor: '#000000',
    dimensions: DEVICE_PRESETS['1080p TV (1920x1080)']
  });

  console.log('🏠 APP RENDER - layout changed:', layout.components.length, 'components');

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<ComponentConfig | null>(null);
  
  // Undo/Redo system - keep track of last 5 actions each
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);

  // Save state for undo
  const saveStateForUndo = useCallback((actionType: UndoAction['type'], description: string, currentLayout: LayoutConfig) => {
    setUndoHistory(prev => {
      const newAction: UndoAction = {
        type: actionType,
        description,
        previousLayout: JSON.parse(JSON.stringify(currentLayout)) // Deep copy
      };
      
      // Keep only last 5 actions
      const newHistory = [newAction, ...prev].slice(0, 5);
      return newHistory;
    });
    
    // Clear redo history when a new action is performed
    setRedoHistory([]);
  }, []);

  // Undo function
  const undo = useCallback(() => {
    if (undoHistory.length === 0) return;
    
    const [lastAction, ...remainingHistory] = undoHistory;
    
    // Save current state to redo history before undoing
    const currentRedoAction: UndoAction = {
      type: lastAction.type,
      description: lastAction.description,
      previousLayout: JSON.parse(JSON.stringify(layout)) // Deep copy current state
    };
    
    setRedoHistory(prev => [currentRedoAction, ...prev].slice(0, 5)); // Keep last 5 redo actions
    setLayout(lastAction.previousLayout);
    setUndoHistory(remainingHistory);
    setSelectedComponents([]); // Clear selection after undo
  }, [undoHistory, layout]);

  // Redo function
  const redo = useCallback(() => {
    if (redoHistory.length === 0) return;
    
    const [lastRedoAction, ...remainingRedoHistory] = redoHistory;
    
    // Save current state to undo history before redoing
    const currentUndoAction: UndoAction = {
      type: lastRedoAction.type,
      description: lastRedoAction.description,
      previousLayout: JSON.parse(JSON.stringify(layout)) // Deep copy current state
    };
    
    setUndoHistory(prev => [currentUndoAction, ...prev].slice(0, 5)); // Keep last 5 undo actions
    setLayout(lastRedoAction.previousLayout);
    setRedoHistory(remainingRedoHistory);
    setSelectedComponents([]); // Clear selection after redo
  }, [redoHistory, layout]);

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

  const addComponent = useCallback((type: ComponentConfig['type'], customPosition?: { x: number, y: number }, customSize?: { width: number, height: number }) => {
    // Save current state for undo
    saveStateForUndo('ADD_COMPONENT', `Add ${type} component`, layout);
    
    // Calculate next layer value (one higher than the highest existing layer)
    const highestLayer = layout.components.reduce((max, comp) => 
      Math.max(max, comp.layer || 0), 0
    );
    
    const newComponent: ComponentConfig = {
      id: `${type}_${Date.now()}`,
      type,
      position: customPosition || { x: 10, y: 10 }, // 10% from left, 10% from top
      size: customSize || getDefaultSize(type),
      layer: highestLayer + 1,
      props: getDefaultProps(type),
      team: needsTeam(type) ? 'home' : undefined
    };

    setLayout(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
    }));
  }, [layout, saveStateForUndo]);

  // Add a ref to track if we're currently dragging to batch position updates
  const isDraggingRef = React.useRef(false);
  const dragStartStateRef = React.useRef<LayoutConfig | null>(null);

  const updateComponent = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    console.log('🔥 APP UPDATE COMPONENT CALLED:', id, updates, new Error().stack?.split('\n')[2]);
    setLayout(prev => {
      const component = prev.components.find(c => c.id === id);
      if (component) {
        // Check if this is a position/size update (drag/resize operation)
        const isDragUpdate = Object.keys(updates).some(key => ['position', 'size'].includes(key));
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

  // Function to start a drag operation (save initial state)
  const startDragOperation = useCallback(() => {
    if (!isDraggingRef.current) {
      dragStartStateRef.current = JSON.parse(JSON.stringify(layout)); // Deep copy
      isDraggingRef.current = true;
    }
  }, [layout]);

  // Function to end a drag operation (save final state for undo)
  const endDragOperation = useCallback((description: string) => {
    if (isDraggingRef.current && dragStartStateRef.current) {
      saveStateForUndo('UPDATE_COMPONENT', description, dragStartStateRef.current);
      isDraggingRef.current = false;
      dragStartStateRef.current = null;
    }
  }, [saveStateForUndo]);

  const deleteComponent = useCallback((id: string) => {
    const component = layout.components.find(c => c.id === id);
    if (component) {
      saveStateForUndo('DELETE_COMPONENT', `Delete ${component.type} component`, layout);
    }
    
    setLayout(prev => ({
      ...prev,
      components: prev.components.filter(comp => comp.id !== id)
    }));
    setSelectedComponents(prev => prev.filter(compId => compId !== id));
  }, [layout, saveStateForUndo]);

  const duplicateComponent = useCallback((id: string) => {
    const original = layout.components.find(comp => comp.id === id);
    if (original) {
      saveStateForUndo('DUPLICATE_COMPONENT', `Duplicate ${original.type} component`, layout);
      
      const duplicate: ComponentConfig = {
        ...original,
        id: `${original.type}_${Date.now()}`,
        position: {
          x: original.position.x + 2, // 2% offset
          y: original.position.y + 2  // 2% offset
        }
      };
      setLayout(prev => ({
        ...prev,
        components: [...prev.components, duplicate]
      }));
    }
  }, [layout, saveStateForUndo]);

  const loadPresetLayout = useCallback((presetName: string) => {
    saveStateForUndo('LOAD_PRESET', `Load ${presetName} preset`, layout);
    
    const presets = {
      'basketball': basketballLayout,
      'volleyball': volleyballLayout,
      'soccer': soccerLayout
    };
    
    const preset = presets[presetName as keyof typeof presets];
    if (preset) {
      setLayout(preset);
      setSelectedComponents([]);
    }
  }, [layout, saveStateForUndo]);

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
              DEVICE_PRESETS[key].width === layout.dimensions.width && 
              DEVICE_PRESETS[key].height === layout.dimensions.height
            ) || 'Custom 16:9'}
            onChange={(e) => setLayout(prev => ({ 
              ...prev, 
              dimensions: DEVICE_PRESETS[e.target.value]
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
        <LayerPanel
          layout={layout}
          selectedComponents={selectedComponents}
          onSelectComponents={setSelectedComponents}
          onUpdateComponent={updateComponent}
        />
        
        <Canvas
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
        
      
      </div>

      {showExportModal && (
        <ExportModal
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