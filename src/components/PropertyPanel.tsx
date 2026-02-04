import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import {
  loadAvailableImages,
  getImagePath,
  AVAILABLE_SPORTS,
  Sport,
  getSubsections,
  hasSubsections,
  getAvailableImagesForSport,
} from '../utils/imageUtils';
import ColorPicker from './ColorPicker';
import { EffectPropertySection, EffectName, EffectConfig, TriggerOptions } from '../effects';
import './PropertyPanel.css';

// Helper to resolve image paths with BASE_URL for loading
const resolveImagePath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = import.meta.env.BASE_URL || '/';
  if (path.startsWith('/')) {
    return `${baseUrl}${path.slice(1)}`;
  }
  return `${baseUrl}${path}`;
};

interface PropertyPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onUpdateLayout: (layout: LayoutConfig) => void;
  gameData?: any;
  onUpdateGameData?: (gameData: any) => void;
  panelWidth?: number;
  onPreviewEffect?: (componentId: string, effectName: EffectName, options?: TriggerOptions) => void;
}

// Width threshold for two-column layout
const TWO_COLUMN_THRESHOLD = 450;


// Simple number input handlers - no complex hook needed

function PropertyPanel({
  layout,
  selectedComponents,
  onUpdateComponent,
  onUpdateLayout,
  gameData,
  onUpdateGameData,
  panelWidth = 320,
  onPreviewEffect
}: PropertyPanelProps) {
  const useTwoColumns = panelWidth >= TWO_COLUMN_THRESHOLD;
  // Skip heavy computation during drag operations to improve performance
  const [isDragging, setIsDragging] = useState(false);
  
  // State for dynamically loaded images
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<Sport>('Basketball');
  const [selectedSubsection, setSelectedSubsection] = useState<string | undefined>(undefined);

  // Get available subsections for the selected sport
  const availableSubsections = useMemo(() => {
    return getSubsections(selectedSport);
  }, [selectedSport]);

  const sportHasSubsections = useMemo(() => {
    return hasSubsections(selectedSport);
  }, [selectedSport]);
  
  // Create a frozen component reference that doesn't change during drag operations
  const [frozenComponent, setFrozenComponent] = useState<ComponentConfig | null>(null);
  
  // State for tracking which state properties we're editing (1 or 2)
  const [editingState, setEditingState] = useState<1 | 2>(1);
  
  // Update frozen component only when not dragging
  useEffect(() => {
    if (!isDragging) {
      const currentComponent = selectedComponents.length === 1 
        ? (layout.components || []).find(c => c.id === selectedComponents[0]) || null
        : null;
      setFrozenComponent(currentComponent);
    }
  }, [layout.components, selectedComponents, isDragging]);

  // Load available images on mount and when sport/subsection changes
  useEffect(() => {
    const loadImages = async () => {
      setImagesLoading(true);
      try {
        const images = await loadAvailableImages(selectedSport, selectedSubsection);
        setAvailableImages(images);
      } catch (error) {
        console.error('Failed to load images:', error);
        setAvailableImages([]);
      } finally {
        setImagesLoading(false);
      }
    };

    loadImages();
  }, [selectedSport, selectedSubsection]);

  // Reset subsection when sport changes
  useEffect(() => {
    setSelectedSubsection(undefined);
  }, [selectedSport]);
  
  // Use frozen component during drag, live component otherwise
  const component = isDragging ? frozenComponent : (
    selectedComponents.length === 1 
      ? layout.components.find(c => c.id === selectedComponents[0]) || null
      : null
  );

  // Create a stable component ID reference to prevent callback recreation
  const componentId = component?.id;
  
  // Simple text input handlers - similar to number inputs
  const handleTextChange = useCallback(() => {
    // No-op during typing to avoid interrupting user input
  }, []);
  
  const handleTextBlur = useCallback((field: string, value: string) => {
    if (!component || !componentId) return;
    
    onUpdateComponent(componentId, {
      props: { ...component.props, [field]: value }
    });
  }, [component, componentId, onUpdateComponent]);
  
  // Listen for drag state changes to pause expensive rendering
  React.useEffect(() => {
    const handleDragStart = () => {
      setIsDragging(true);
    };
    const handleDragEnd = () => {
      setIsDragging(false);
    };
    
    window.addEventListener('canvas-drag-start', handleDragStart);
    window.addEventListener('canvas-drag-end', handleDragEnd);
    
    return () => {
      window.removeEventListener('canvas-drag-start', handleDragStart);
      window.removeEventListener('canvas-drag-end', handleDragEnd);
    };
  }, []);
  
  // State for collapsed sections - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([
    'position-size',
    'team',
    'text',
    'custom-data',
    'image',
    'borders',
    'effects',
    'dynamic-list-data',
    'dynamic-list-active',
    'dynamic-list-inactive',
    'dynamic-list-borders',
    'dynamic-list-layout'
  ]));
  
  // Memoized update functions with minimal dependencies
  const updateX = useCallback((pixelValue: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        position: { ...component.position, x: pixelValue }
      });
    }
  }, [componentId, component]);

  const updateY = useCallback((pixelValue: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        position: { ...component.position, y: pixelValue }
      });
    }
  }, [componentId, component]);

  const updateWidth = useCallback((pixelValue: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        size: { ...component.size, width: pixelValue }
      });
    }
  }, [componentId, component]);

  const updateHeight = useCallback((pixelValue: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        size: { ...component.size, height: pixelValue }
      });
    }
  }, [componentId, component]);

  const updateLayer = useCallback((value: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, { layer: value });
    }
  }, [componentId]);

  const updateFontSize = useCallback((value: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        props: { ...component.props, fontSize: value || 24 }
      });
    }
  }, [componentId, component]);

  const updateBorderWidth = useCallback((value: number) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        props: { ...component.props, borderWidth: value }
      });
    }
  }, [componentId, component]);


  // Simple number input handlers
  const handleNumberChange = useCallback((field: string, value: string) => {
    // No-op during typing to avoid interrupting user input
  }, []);

  const handleNumberBlur = useCallback((field: string, value: string) => {
    if (!component || !componentId) return;

    const numValue = parseInt(value) || 0;
    
    switch (field) {
      case 'x':
        updateX(numValue);
        break;
      case 'y':
        updateY(numValue);
        break;
      case 'width':
        updateWidth(numValue);
        break;
      case 'height':
        updateHeight(numValue);
        break;
      case 'layer':
        updateLayer(numValue);
        break;
      case 'fontSize':
        updateFontSize(numValue);
        break;
      case 'borderWidth':
        updateBorderWidth(numValue);
        break;
      case 'totalCount':
      case 'activeCount':
        if (component && componentId) {
          updateComponentWithScrollPreservation(componentId, {
            props: { ...component.props, [field]: numValue }
          });
        }
        break;
      // Common numeric props - handle these after updateComponentWithScrollPreservation is available
      case 'maxTimeouts':
      case 'itemSpacing':
      case 'borderRadius':
      case 'paddingTop':
      case 'paddingRight':
      case 'paddingBottom':
      case 'paddingLeft':
      case 'borderTopWidth':
      case 'borderRightWidth':
      case 'borderBottomWidth':
      case 'borderLeftWidth':
      case 'borderTopLeftRadius':
      case 'borderTopRightRadius':
      case 'borderBottomLeftRadius':
      case 'borderBottomRightRadius':
        // These will be handled by separate blur handlers for now
        break;
    }
  }, [component, componentId, updateX, updateY, updateWidth, updateHeight, updateLayer, updateFontSize, updateBorderWidth]);

  // Create a static color swatch for drag operations
  const StaticColorSwatch = ({ label, color }: { label: string, color: string }) => (
    <div className="property-field">
      <label className="color-picker-label">{label}</label>
      <div className="color-picker-container">
        <div
          className="color-picker-swatch"
          style={{ backgroundColor: color, cursor: 'not-allowed', opacity: 0.7 }}
        >
          <div className="color-picker-checkerboard" />
          <div className="color-picker-color" style={{ backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
  
  
  // Ref to maintain scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Save scroll position on every scroll
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  }, []);

  // Restore scroll after render
  useLayoutEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  });

  // Simple update - just call onUpdateComponent
  const updateComponentWithScrollPreservation = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    onUpdateComponent(id, updates);
  }, [onUpdateComponent]);

  // Generic prop update functions
  const updateProp = useCallback((propName: string, value: any) => {
    if (component && componentId) {
      updateComponentWithScrollPreservation(componentId, {
        props: { ...component.props, [propName]: value }
      });
    }
  }, [componentId, component, updateComponentWithScrollPreservation]);

  // Text input handlers (for blur-only updates)
  const handlePropTextChange = useCallback((field: string, value: string) => {
    // No-op during typing to avoid interrupting user input
  }, []);

  const handlePropTextBlur = useCallback((field: string, value: string) => {
    if (!component || !componentId) return;
    updateProp(field, value);
  }, [component, componentId, updateProp]);

  // State props handlers (for blur-only updates)
  const handleStatePropsChange = useCallback((field: string, value: any) => {
    // No-op during typing to avoid interrupting user input
  }, []);

  const handleStatePropsBlur = useCallback((field: string, value: string) => {
    if (!component || !componentId) return;

    // Determine the appropriate value based on field type
    let processedValue: any = value;
    if (['fontSize', 'borderWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
         'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
         'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].includes(field)) {
      processedValue = parseInt(value) || 0;
    }

    if (component.props?.canToggle) {
      // Store in state-specific properties
      const stateKey = editingState === 1 ? 'state1Props' : 'state2Props';
      updateComponentWithScrollPreservation(componentId, {
        props: {
          ...component.props,
          [stateKey]: {
            ...component.props[stateKey],
            [field]: processedValue
          }
        }
      });
    } else {
      // Store directly in props
      updateComponentWithScrollPreservation(componentId, {
        props: { ...component.props, [field]: processedValue }
      });
    }
  }, [component, componentId, editingState, updateComponentWithScrollPreservation]);

  // Additional number handler for props that couldn't be handled in early handleNumberBlur
  const handleLateNumberBlur = useCallback((field: string, value: string) => {
    if (!component || !componentId) return;
    const numValue = parseInt(value) || 0;
    updateProp(field, numValue);
  }, [component, componentId, updateProp]);

  // Helper function to update properties based on current editing state
  const updateStateProps = useCallback((field: string, value: any) => {
    if (!component || !componentId) return;
    
    if (component.props?.canToggle) {
      // Store in state-specific properties
      const stateKey = editingState === 1 ? 'state1Props' : 'state2Props';
      const currentStateProps = component.props[stateKey] || {};
      
      updateComponentWithScrollPreservation(componentId, {
        props: {
          ...component.props,
          [stateKey]: {
            ...currentStateProps,
            [field]: value
          }
        }
      });
    } else {
      // Regular property update
      updateComponentWithScrollPreservation(componentId, {
        props: {
          ...component.props,
          [field]: value
        }
      });
    }
  }, [component, componentId, editingState, updateComponentWithScrollPreservation]);
  
  // Helper to get the current property value based on editing state
  const getStateValue = useCallback((field: string, defaultValue?: any) => {
    if (!component?.props) return defaultValue;

    if (component.props?.canToggle) {
      const stateKey = editingState === 1 ? 'state1Props' : 'state2Props';
      const stateProps = component.props[stateKey] || {};
      return stateProps[field] !== undefined ? stateProps[field] : (component.props[field] || defaultValue);
    }

    return component.props[field] || defaultValue;
  }, [component, editingState]);

  // Handler for image selection - sets native resolution and centers on canvas
  // For toggleable components, only updates the image for the current editing state
  const handleImageSelect = useCallback((newImagePath: string, isUrl: boolean = false) => {
    if (!component || !componentId) return;

    // For toggleable components, update image in current state with a single update
    // to avoid race conditions from multiple consecutive updateStateProps calls
    if (component.props?.canToggle) {
      const stateKey = editingState === 1 ? 'state1Props' : 'state2Props';
      const currentStateProps = component.props[stateKey] || {};

      const imageUpdates = isUrl
        ? { imageUrl: newImagePath, imageSource: 'url' }
        : { imagePath: newImagePath, imageSource: 'local' };

      updateComponentWithScrollPreservation(componentId, {
        props: {
          ...component.props,
          [stateKey]: {
            ...currentStateProps,
            ...imageUpdates
          }
        }
      });
      return;
    }

    // For non-toggleable components with empty path, just clear
    if (!newImagePath) {
      if (isUrl) {
        updateStateProps('imageUrl', newImagePath);
      } else {
        updateStateProps('imagePath', newImagePath);
      }
      return;
    }

    // For non-toggleable components, update with centering and native resolution
    // First update the image path/url
    if (isUrl) {
      updateStateProps('imageUrl', newImagePath);
    } else {
      updateStateProps('imagePath', newImagePath);
    }

    // Then load the image to get native dimensions and center it
    const img = new window.Image();
    img.onload = () => {
      const nativeWidth = img.naturalWidth;
      const nativeHeight = img.naturalHeight;

      // Calculate center position
      const centerX = (layout.dimensions.width - nativeWidth) / 2;
      const centerY = (layout.dimensions.height - nativeHeight) / 2;

      const propsUpdate: any = {
        ...component.props,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        objectFit: 'none',
        backgroundColor: 'transparent'
      };

      if (isUrl) {
        propsUpdate.imageUrl = newImagePath;
      } else {
        propsUpdate.imagePath = newImagePath;
      }

      updateComponentWithScrollPreservation(componentId, {
        position: {
          x: Math.max(0, centerX),
          y: Math.max(0, centerY)
        },
        size: {
          width: nativeWidth,
          height: nativeHeight
        },
        originalAspectRatio: nativeWidth / nativeHeight,
        props: propsUpdate
      });
    };
    img.onerror = () => {
      console.error('Failed to load image for dimension detection:', newImagePath);
    };
    img.src = resolveImagePath(newImagePath);
  }, [component, componentId, editingState, layout.dimensions, updateStateProps, updateComponentWithScrollPreservation]);

  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  // Section component for consistent styling
  const PropertySection = ({ title, sectionKey, children }: { title: string, sectionKey: string, children: React.ReactNode }) => {
    const isCollapsed = collapsedSections.has(sectionKey);
    return (
      <div className="property-section">
        <button
          className={`section-header ${isCollapsed ? 'collapsed' : ''}`}
          onClick={() => toggleSection(sectionKey)}
        >
          <span className="section-title">{title}</span>
          <span className="section-toggle">{isCollapsed ? '▶' : '▼'}</span>
        </button>
        {!isCollapsed && (
          <div className="section-content">
            {children}
          </div>
        )}
      </div>
    );
  };


  // Helper to update penalty count for preview
  const updatePenaltyCount = (team: 'home' | 'away', count: number) => {
    if (!onUpdateGameData || !gameData) return;

    const newGameData = { ...gameData };
    const slots = newGameData.penaltySlots?.[team] || {};

    newGameData.penaltySlots = {
      ...newGameData.penaltySlots,
      [team]: {
        ...slots,
        count,
        isState0: count === 0,
        isState1: count === 1,
        isState2: count === 2,
        isState3: count === 3,
        slot0: { ...slots.slot0, active: count >= 1 },
        slot1: { ...slots.slot1, active: count >= 2 },
        slot2: { ...slots.slot2, active: count >= 3 },
      }
    };

    onUpdateGameData(newGameData);
  };

  // Helper to update a nested game data value
  const updateGameDataValue = (path: string, value: any) => {
    if (!onUpdateGameData || !gameData) return;

    const newGameData = { ...gameData };
    const keys = path.split('.');
    let current: any = newGameData;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    onUpdateGameData(newGameData);
  };

  // Collapsible section component for game data
  const GameDataSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div style={{ marginBottom: '8px', border: '1px solid #444', borderRadius: '4px' }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#333',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: isOpen ? '4px 4px 0 0' : '4px'
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{title}</span>
          <span style={{ fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</span>
        </div>
        {isOpen && (
          <div style={{ padding: '12px', backgroundColor: '#2a2a2a' }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  // Input field component for game data
  const GameDataInput = ({ label, path, type = 'text', min, max }: { label: string; path: string; type?: string; min?: number; max?: number }) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], gameData as any) ?? '';
    return (
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</label>
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          onChange={(e) => updateGameDataValue(path, type === 'number' ? Number(e.target.value) : e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px'
          }}
        />
      </div>
    );
  };

  // Color picker for game data
  const GameDataColor = ({ label, path }: { label: string; path: string }) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], gameData as any) ?? '#ffffff';
    return (
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="color"
            value={value}
            onChange={(e) => {
              updateGameDataValue(path, e.target.value);
              // Also update the flat color fields for compatibility
              if (path === 'homeTeam.color') updateGameDataValue('home_team_color', e.target.value);
              if (path === 'awayTeam.color') updateGameDataValue('away_team_color', e.target.value);
            }}
            style={{ width: '40px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              updateGameDataValue(path, e.target.value);
              if (path === 'homeTeam.color') updateGameDataValue('home_team_color', e.target.value);
              if (path === 'awayTeam.color') updateGameDataValue('away_team_color', e.target.value);
            }}
            style={{
              flex: 1,
              padding: '6px 8px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px'
            }}
          />
        </div>
      </div>
    );
  };

  // Boolean toggle for game data
  const GameDataToggle = ({ label, path }: { label: string; path: string }) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], gameData as any) ?? false;
    return (
      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '11px', color: '#888' }}>{label}</label>
        <button
          onClick={() => updateGameDataValue(path, !value)}
          style={{
            padding: '4px 12px',
            backgroundColor: value ? '#4CAF50' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {value ? 'ON' : 'OFF'}
        </button>
      </div>
    );
  };

  if (selectedComponents.length === 0) {
    return (
      <div className={`property-panel ${useTwoColumns ? 'two-columns' : ''}`}>
        <div className="property-header">
          <h3>Preview Data</h3>
        </div>
        <div className="property-content" style={{ padding: '12px' }}>
          <div style={{ marginBottom: '12px', color: '#888', fontSize: '11px' }}>
            Adjust game data to preview different states
          </div>

          {/* Team Names & Colors */}
          <GameDataSection title="Team Info" defaultOpen={true}>
            <GameDataInput label="Home Team Name" path="homeTeam.name" />
            <GameDataColor label="Home Team Color" path="homeTeam.color" />
            <div style={{ height: '8px' }} />
            <GameDataInput label="Away Team Name" path="awayTeam.name" />
            <GameDataColor label="Away Team Color" path="awayTeam.color" />
          </GameDataSection>

          {/* Scores */}
          <GameDataSection title="Scores" defaultOpen={true}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Score" path="homeTeam.score" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Score" path="awayTeam.score" type="number" min={0} />
              </div>
            </div>
          </GameDataSection>

          {/* Clock & Period */}
          <GameDataSection title="Clock & Period" defaultOpen={true}>
            <GameDataInput label="Game Clock" path="gameClock" />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Period" path="period" type="number" min={1} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Quarter" path="quarter" type="number" min={1} />
              </div>
            </div>
            <GameDataInput label="Shot Clock" path="shotClock" type="number" min={0} />
            <GameDataToggle label="Overtime" path="isOvertime" />
          </GameDataSection>

          {/* Fouls & Timeouts */}
          <GameDataSection title="Fouls & Timeouts">
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Fouls" path="homeTeam.fouls" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Fouls" path="awayTeam.fouls" type="number" min={0} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Timeouts" path="homeTeam.timeouts" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Timeouts" path="awayTeam.timeouts" type="number" min={0} />
              </div>
            </div>
            <GameDataToggle label="Home Bonus" path="homeTeam.bonus" />
            <GameDataToggle label="Home Double Bonus" path="homeTeam.doubleBonus" />
            <GameDataToggle label="Away Bonus" path="awayTeam.bonus" />
            <GameDataToggle label="Away Double Bonus" path="awayTeam.doubleBonus" />
          </GameDataSection>

          {/* Possession */}
          <GameDataSection title="Possession">
            <GameDataToggle label="Home Possession" path="homeTeam.possession" />
            <GameDataToggle label="Away Possession" path="awayTeam.possession" />
          </GameDataSection>

          {/* Penalties (Lacrosse/Hockey) */}
          <GameDataSection title="Penalties (Lacrosse/Hockey)">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
                Home Penalty Count
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => updatePenaltyCount('home', count)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: gameData?.penaltySlots?.home?.count === count ? '#4CAF50' : '#333',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: gameData?.penaltySlots?.home?.count === count ? 'bold' : 'normal',
                      fontSize: '14px'
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
                Away Penalty Count
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => updatePenaltyCount('away', count)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: gameData?.penaltySlots?.away?.count === count ? '#4CAF50' : '#333',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: gameData?.penaltySlots?.away?.count === count ? 'bold' : 'normal',
                      fontSize: '14px'
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            {/* Penalty slot details */}
            {(gameData?.penaltySlots?.home?.count > 0 || gameData?.penaltySlots?.away?.count > 0) && (
              <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '11px' }}>
                <div style={{ color: '#888', marginBottom: '8px' }}>Penalty Slot Data:</div>
                {gameData?.penaltySlots?.home?.count > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#aaa', marginBottom: '4px' }}>Home:</div>
                    {[0, 1, 2].slice(0, gameData?.penaltySlots?.home?.count).map((i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <input
                          placeholder={`#${i + 1} Jersey`}
                          value={gameData?.penaltySlots?.home?.[`slot${i}`]?.jersey || ''}
                          onChange={(e) => updateGameDataValue(`penaltySlots.home.slot${i}.jersey`, e.target.value)}
                          style={{ flex: 1, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Time"
                          value={gameData?.penaltySlots?.home?.[`slot${i}`]?.time || ''}
                          onChange={(e) => updateGameDataValue(`penaltySlots.home.slot${i}.time`, e.target.value)}
                          style={{ flex: 1, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {gameData?.penaltySlots?.away?.count > 0 && (
                  <div>
                    <div style={{ color: '#aaa', marginBottom: '4px' }}>Away:</div>
                    {[0, 1, 2].slice(0, gameData?.penaltySlots?.away?.count).map((i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <input
                          placeholder={`#${i + 1} Jersey`}
                          value={gameData?.penaltySlots?.away?.[`slot${i}`]?.jersey || ''}
                          onChange={(e) => updateGameDataValue(`penaltySlots.away.slot${i}.jersey`, e.target.value)}
                          style={{ flex: 1, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Time"
                          value={gameData?.penaltySlots?.away?.[`slot${i}`]?.time || ''}
                          onChange={(e) => updateGameDataValue(`penaltySlots.away.slot${i}.time`, e.target.value)}
                          style={{ flex: 1, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </GameDataSection>

          {/* Other Clocks */}
          <GameDataSection title="Other Clocks">
            <GameDataInput label="Activity Clock" path="activityClock" />
            <GameDataInput label="Timeout Clock" path="timeoutClock" />
            <GameDataInput label="Timer Name" path="timerName" />
            <GameDataInput label="Session Name" path="sessionName" />
            <GameDataInput label="Next Up" path="nextUp" />
          </GameDataSection>

          {/* Sets (Volleyball/Tennis) */}
          <GameDataSection title="Sets (Volleyball/Tennis)">
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Sets Won" path="home_sets_won" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Sets Won" path="away_sets_won" type="number" min={0} />
              </div>
            </div>
            <GameDataInput label="Current Set" path="set" type="number" min={1} />
          </GameDataSection>

          {/* Player Points (Wrestling/Individual) */}
          <GameDataSection title="Player Points (Wrestling)">
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Player Name" path="home_player_name" />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Player Name" path="away_player_name" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Player Points" path="home_player_points" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Player Points" path="away_player_points" type="number" min={0} />
              </div>
            </div>
          </GameDataSection>

          {/* Shots & Saves (Lacrosse/Hockey) */}
          <GameDataSection title="Shots & Saves (Lacrosse/Hockey)">
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Shots" path="home_shots" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Shots" path="away_shots" type="number" min={0} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Home Saves" path="home_saves" type="number" min={0} />
              </div>
              <div style={{ flex: 1 }}>
                <GameDataInput label="Away Saves" path="away_saves" type="number" min={0} />
              </div>
            </div>
          </GameDataSection>
        </div>
      </div>
    );
  }

  if (selectedComponents.length > 1) {
    const multiComponents = selectedComponents
      .map(id => layout.components.find(c => c.id === id))
      .filter((c): c is ComponentConfig => c !== undefined);

    return (
      <div className={`property-panel ${useTwoColumns ? 'two-columns' : ''}`}>
        <div className="property-header">
          <h3>Multi-Select Properties</h3>
          <span className="component-count">{selectedComponents.length} components</span>
        </div>
        <div className="property-content">
          <div className="multi-select-info">
            <h4>Selected Components:</h4>
            <div className="selected-components-list">
              {multiComponents.map(component => (
                <div key={component.id} className="selected-component-item">
                  <span className="component-icon">
                    {component.type === 'custom' ? '[C]' :
                     component.type === 'dynamicList' ? '[L]' : '[T]'}
                  </span>
                  <span className="component-name">
                    {component.displayName || component.type}
                  </span>
                  <span className="component-type">({component.type})</span>
                </div>
              ))}
            </div>

            <div className="multi-select-actions">
              <h4>Multi-Select Actions:</h4>
              <div className="action-buttons">
                <button
                  className="action-button"
                  onClick={() => selectedComponents.forEach(id => onUpdateComponent(id, { layer: 0 }))}
                  title="Move all selected components to layer 0"
                >
                  📍 Reset to Layer 0
                </button>
                <button
                  className="action-button"
                  onClick={() => {
                    const maxLayer = Math.max(...layout.components.map(c => c.layer || 0));
                    selectedComponents.forEach((id, index) =>
                      onUpdateComponent(id, { layer: maxLayer + index + 1 })
                    );
                  }}
                  title="Move all selected components to front"
                >
                  ⬆️ Bring to Front
                </button>
              </div>

              <div className="multi-select-tips">
                <h4>Tips:</h4>
                <ul>
                  <li>• Drag any selected component to move all together</li>
                  <li>• Use the green handles around the group to scale all together</li>
                  <li>• Press Delete to remove all selected components</li>
                  <li>• Ctrl+D to duplicate all selected components</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If component not found, show error message
  if (!component) {
    return (
      <div className={`property-panel ${useTwoColumns ? 'two-columns' : ''}`}>
        <div className="property-header">
          <h3>Properties</h3>
        </div>
        <div className="property-content">
          <div className="no-selection">
            Component not found.<br />
            The selected component may have been deleted.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`property-panel ${useTwoColumns ? 'two-columns' : ''}`}>
      <div className="property-header">
        <h3>{component.displayName || component.type} Properties</h3>
        {component.team && (
          <span className="team-badge">{component.team}</span>
        )}
      </div>
      
      {/* State Selector for toggleable components */}
      {component.props?.canToggle && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444'
        }}>
          <button
            onClick={() => setEditingState(1)}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: editingState === 1 ? '#4CAF50' : '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: editingState === 1 ? 'bold' : 'normal'
            }}
          >
            Edit State 1
          </button>
          <button
            onClick={() => setEditingState(2)}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: editingState === 2 ? '#4CAF50' : '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: editingState === 2 ? 'bold' : 'normal'
            }}
          >
            Edit State 2
          </button>
          <button
            onClick={() => updateComponentWithScrollPreservation(component.id, {
              props: { 
                ...component.props, 
                toggleState: !component.props?.toggleState 
              }
            })}
            style={{
              padding: '8px 16px',
              backgroundColor: component.props?.toggleState ? '#FF9800' : '#607D8B',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {component.props?.toggleState ? 'ON' : 'OFF'}
          </button>
        </div>
      )}
      
      {/* Display Name Field */}
      <div className="property-section">
        <div className="property-field">
          <label>Display Name</label>
          <input
            type="text"
            value={component.displayName || ''}
            onChange={(e) => updateComponentWithScrollPreservation(component.id, {
              displayName: e.target.value
            })}
            placeholder={`${component.type} component`}
            style={{ maxWidth: '200px' }}
          />
        </div>
      </div>
      
      <div 
        className="property-content" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {/* POSITION & SIZE SECTION */}
        <PropertySection title="POSITION & SIZE" sectionKey="position-size">
          <div className="property-grid">
            <div className="property-field">
              <label>X (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.position.x) : 0}
                onBlur={(e) => {
                  updateComponentWithScrollPreservation(component.id, {
                    position: { ...component.position, x: parseInt(e.target.value) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Y (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.position.y) : 0}
                onBlur={(e) => {
                  updateComponentWithScrollPreservation(component.id, {
                    position: { ...component.position, y: parseInt(e.target.value) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Width (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.size.width) : 0}
                onBlur={(e) => {
                  updateComponentWithScrollPreservation(component.id, {
                    size: { ...component.size, width: parseInt(e.target.value) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Height (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.size.height) : 0}
                onBlur={(e) => {
                  updateComponentWithScrollPreservation(component.id, {
                    size: { ...component.size, height: parseInt(e.target.value) || 0 }
                  });
                }}
              />
            </div>
          </div>
          <div className="property-field" style={{ marginTop: '12px' }}>
            <label>Scale Anchor (Cmd/Ctrl + drag)</label>
            <select
              value={component?.scaleAnchor || 'center'}
              onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                scaleAnchor: e.target.value as any
              })}
            >
              <option value="center">Center (default)</option>
              <option value="top">Top Center</option>
              <option value="bottom">Bottom Center</option>
              <option value="left">Left Center</option>
              <option value="right">Right Center</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>
          {component?.originalAspectRatio && (
            <div className="property-field" style={{ marginTop: '8px' }}>
              <label>Aspect Ratio</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {component.originalAspectRatio.toFixed(4)} ({Math.round(component.size.width)}:{Math.round(component.size.width / component.originalAspectRatio)})
                </span>
                <button
                  onClick={() => updateComponentWithScrollPreservation(component.id, {
                    originalAspectRatio: undefined
                  })}
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  title="Clear locked aspect ratio"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {!component?.originalAspectRatio && (
            <div className="property-field" style={{ marginTop: '8px' }}>
              <button
                onClick={() => updateComponentWithScrollPreservation(component.id, {
                  originalAspectRatio: component.size.width / component.size.height
                })}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                title="Lock current aspect ratio for precise scaling"
              >
                Lock Aspect Ratio
              </button>
            </div>
          )}
        </PropertySection>

        {/* TEAM SECTION (if applicable) */}
        {component.team && (
          <PropertySection title="TEAM" sectionKey="team">
            <select
              value={component.team}
              onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                team: e.target.value as 'home' | 'away'
              })}
            >
              <option value="home">Home Team</option>
              <option value="away">Away Team</option>
            </select>
          </PropertySection>
        )}

        {/* TEXT SECTION */}
        <PropertySection title="TEXT" sectionKey="text">
          <div className="property-field">
            <label>Font Size</label>
            <input
              type="number"
              defaultValue={getStateValue('fontSize', 24)}
              onChange={(e) => handleStatePropsChange('fontSize', e.target.value)}
              onBlur={(e) => handleStatePropsBlur('fontSize', e.target.value)}
            />
          </div>

          <div className="property-field">
            <label>Font Family</label>
            <select
              value={getStateValue('fontFamily', 'Score-Regular')}
              onChange={(e) => updateStateProps('fontFamily', e.target.value)}
            >
              <option value="Score-Regular">Score-Regular (Numbers/Clocks)</option>
              <option value="Helvetica-Bold">Helvetica Bold (Classic Text)</option>
            </select>
          </div>

          <div className="property-field">
            <label>
              <input
                type="checkbox"
                checked={getStateValue('autoFitText', false)}
                onChange={(e) => updateStateProps('autoFitText', e.target.checked)}
              />
              Auto-Fit Text to Container
            </label>
          </div>

          {getStateValue('autoFitText', false) && (
            <div className="property-field">
              <label>Preview Text (test how text will fit)</label>
              <input
                type="text"
                defaultValue={getStateValue('previewText', '')}
                placeholder="e.g., Jordan's Jaguars"
                onChange={(e) => handleStatePropsChange('previewText', e.target.value)}
                onBlur={(e) => updateStateProps('previewText', e.target.value)}
              />
              {getStateValue('previewText', '') && (
                <button
                  onClick={() => updateStateProps('previewText', '')}
                  style={{
                    marginTop: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: '#444',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Clear Preview
                </button>
              )}
            </div>
          )}

          <div className="property-field">
            <label>
              <input
                type="checkbox"
                checked={getStateValue('autoContrastText', false)}
                onChange={(e) => updateStateProps('autoContrastText', e.target.checked)}
              />
              Auto-Contrast Text (black/white based on background)
            </label>
          </div>

          {isDragging ? (
            <StaticColorSwatch
              label="Text Color"
              color={component?.props?.textColor || '#ffffff'}
            />
          ) : (
            <div className="property-field">
              <ColorPicker
                label="Text Color"
                value={getStateValue('textColor', '#ffffff')}
                onChange={(color) => updateStateProps('textColor', color)}
              />
            </div>
          )}
          
          <div className="property-field">
            <label>Text Alignment</label>
            <select
              value={getStateValue('textAlign', 'center')}
              onChange={(e) => updateStateProps('textAlign', e.target.value)}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          {getStateValue('label', undefined) !== undefined && (
            <div className="property-field">
              <label>Label</label>
              <input
                type="text"
                defaultValue={getStateValue('label', '')}
                onChange={(e) => handleStatePropsChange('label', e.target.value)}
                onBlur={(e) => handleStatePropsBlur('label', e.target.value)}
              />
            </div>
          )}

          {component.type === 'custom' && (
            <>
              <div className="property-field">
                <label>Custom Text</label>
                <input
                  type="text"
                  defaultValue={getStateValue('customText', '')}
                  placeholder="Static text (overrides data path)"
                  onChange={(e) => handleStatePropsChange('customText', e.target.value)}
                  onBlur={(e) => handleStatePropsBlur('customText', e.target.value)}
                />
              </div>
              <div className="property-grid">
                <div className="property-field">
                  <label>Prefix</label>
                  <input
                    type="text"
                    defaultValue={getStateValue('prefix', '')}
                    placeholder="e.g., '$', '#'"
                    onChange={(e) => handleStatePropsChange('prefix', e.target.value)}
                    onBlur={(e) => handleStatePropsBlur('prefix', e.target.value)}
                  />
                </div>
                <div className="property-field">
                  <label>Suffix</label>
                  <input
                    type="text"
                    defaultValue={getStateValue('suffix', '')}
                    placeholder="e.g., 'pts', '%'"
                    onChange={(e) => handleStatePropsChange('suffix', e.target.value)}
                    onBlur={(e) => handleStatePropsBlur('suffix', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {component.props?.maxTimeouts !== undefined && (
            <div className="property-field">
              <label>Max Timeouts</label>
              <input
                type="number"
                defaultValue={component.props.maxTimeouts}
                min="1"
                max="10"
                onChange={(e) => handleNumberChange('maxTimeouts', e.target.value)}
                onBlur={(e) => handleNumberBlur('maxTimeouts', e.target.value)}
              />
            </div>
          )}

          {component.type === 'period' && (
            <div className="property-field">
              <label>
                <input
                  type="checkbox"
                  checked={component.props?.showPossessionArrows || false}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, showPossessionArrows: e.target.checked }
                  })}
                />
                Show Possession Arrows
              </label>
            </div>
          )}
        </PropertySection>

        {component.type === 'custom' && (
          <>
            {/* CUSTOM DATA SECTION */}
            <PropertySection title="CUSTOM DATA" sectionKey="custom-data">
              <div className="property-field">
                <label>Data Path</label>
                <select
                  value={component.props?.dataPath || 'none'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, dataPath: e.target.value }
                  })}
                >
                  <option value="none">No Data (Display Only)</option>
                  <optgroup label="Game Info">
                    <option value="gameClock">Game Clock</option>
                    <option value="timeoutClock">Timeout Clock</option>
                    <option value="activityClock">Activity Clock</option>
                    <option value="preGameClock">Pre-Game Clock</option>
                    <option value="halftimeClock">Halftime Clock</option>
                    <option value="period">Period/Quarter</option>
                    <option value="isOvertime">Overtime</option>
                    <option value="home_sets_won">Home Sets Won</option>
                    <option value="away_sets_won">Away Sets Won</option>
                  </optgroup>
                  <optgroup label="Activity Timer">
                    <option value="timerName">Timer Name</option>
                    <option value="sessionName">Session Name</option>
                    <option value="nextUp">Next Up</option>
                  </optgroup>
                  <optgroup label="Home Team">
                    <option value="homeTeam.name">Home Team Name</option>
                    <option value="homeTeam.score">Home Score</option>
                    <option value="homeTeam.fouls">Home Fouls</option>
                    <option value="homeTeam.timeouts">Home Timeouts</option>
                    <option value="homeTeam.bonus">Home Bonus</option>
                    <option value="homeTeam.doubleBonus">Home Double Bonus</option>
                    <option value="homeTeam.possession">Home Possession</option>
                  </optgroup>
                  <optgroup label="Away Team">
                    <option value="awayTeam.name">Away Team Name</option>
                    <option value="awayTeam.score">Away Score</option>
                    <option value="awayTeam.fouls">Away Fouls</option>
                    <option value="awayTeam.timeouts">Away Timeouts</option>
                    <option value="awayTeam.bonus">Away Bonus</option>
                    <option value="awayTeam.doubleBonus">Away Double Bonus</option>
                    <option value="awayTeam.possession">Away Possession</option>
                  </optgroup>
                  <optgroup label="Wrestling">
                    <option value="home_player_points">Home Player Score</option>
                    <option value="away_player_points">Away Player Score</option>
                    <option value="home_player_name">Home Player Name</option>
                    <option value="away_player_name">Away Player Name</option>
                  </optgroup>
                  <optgroup label="Shots & Saves (Lacrosse/Hockey)">
                    <option value="home_shots">Home Shots</option>
                    <option value="away_shots">Away Shots</option>
                    <option value="home_saves">Home Saves</option>
                    <option value="away_saves">Away Saves</option>
                  </optgroup>
                  <optgroup label="Home Penalties (Lacrosse/Hockey)">
                    <option value="penaltySlots.home.count">Home Penalty Count</option>
                    <option value="penaltySlots.home.slot0.jersey">Home Penalty 1 - Jersey</option>
                    <option value="penaltySlots.home.slot0.time">Home Penalty 1 - Time</option>
                    <option value="penaltySlots.home.slot0.active">Home Penalty 1 - Active</option>
                    <option value="penaltySlots.home.slot1.jersey">Home Penalty 2 - Jersey</option>
                    <option value="penaltySlots.home.slot1.time">Home Penalty 2 - Time</option>
                    <option value="penaltySlots.home.slot1.active">Home Penalty 2 - Active</option>
                    <option value="penaltySlots.home.slot2.jersey">Home Penalty 3 - Jersey</option>
                    <option value="penaltySlots.home.slot2.time">Home Penalty 3 - Time</option>
                    <option value="penaltySlots.home.slot2.active">Home Penalty 3 - Active</option>
                  </optgroup>
                  <optgroup label="Away Penalties (Lacrosse/Hockey)">
                    <option value="penaltySlots.away.count">Away Penalty Count</option>
                    <option value="penaltySlots.away.slot0.jersey">Away Penalty 1 - Jersey</option>
                    <option value="penaltySlots.away.slot0.time">Away Penalty 1 - Time</option>
                    <option value="penaltySlots.away.slot0.active">Away Penalty 1 - Active</option>
                    <option value="penaltySlots.away.slot1.jersey">Away Penalty 2 - Jersey</option>
                    <option value="penaltySlots.away.slot1.time">Away Penalty 2 - Time</option>
                    <option value="penaltySlots.away.slot1.active">Away Penalty 2 - Active</option>
                    <option value="penaltySlots.away.slot2.jersey">Away Penalty 3 - Jersey</option>
                    <option value="penaltySlots.away.slot2.time">Away Penalty 3 - Time</option>
                    <option value="penaltySlots.away.slot2.active">Away Penalty 3 - Active</option>
                  </optgroup>
                  <optgroup label="Sponsorship">
                    <option value="user_sequences.banner">Banner Ads</option>
                    <option value="user_sequences.timeout">Timeout Ads</option>
                  </optgroup>
                </select>
              </div>

              <div className="property-grid">
                {isDragging ? (
                  <>
                    <StaticColorSwatch 
                      label="Background Color" 
                      color={component?.props?.backgroundColor || '#000000'} 
                    />
                    <StaticColorSwatch 
                      label="Text Color" 
                      color={component?.props?.textColor || '#ffffff'} 
                    />
                  </>
                ) : (
                  <>
                    <div className="property-field">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', color: '#aaa' }}>Background Color</label>
                        <label style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                          <input
                            type="checkbox"
                            checked={(() => {
                              // Check raw props to see if backgroundColor is explicitly set
                              const rawBg = component?.props?.backgroundColor;
                              return rawBg === undefined || rawBg === null || rawBg === 'none';
                            })()}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateStateProps('backgroundColor', 'none');
                              } else {
                                updateStateProps('backgroundColor', '#000000');
                              }
                            }}
                            style={{ margin: 0 }}
                          />
                          None
                        </label>
                      </div>
                      {component?.props?.backgroundColor && component.props.backgroundColor !== 'none' && (
                        <ColorPicker
                          value={component.props.backgroundColor}
                          onChange={(color) => updateStateProps('backgroundColor', color)}
                        />
                      )}
                    </div>
                    <div className="property-field">
                      <ColorPicker
                        label="Text Color"
                        value={getStateValue('textColor', '#ffffff')}
                        onChange={(color) => updateStateProps('textColor', color)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Team Color Controls */}
              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component?.useTeamColor || false}
                    onChange={(e) => component && updateComponentWithScrollPreservation(component.id, {
                      useTeamColor: e.target.checked,
                      teamColorSide: component.teamColorSide || 'home'
                    })}
                  />
                  Use Team Color
                </label>
              </div>

              {component?.useTeamColor && (
                <div className="property-field">
                  <label>Team Color Side</label>
                  <select
                    value={component?.teamColorSide || 'home'}
                    onChange={(e) => component && updateComponentWithScrollPreservation(component.id, {
                      teamColorSide: e.target.value as 'home' | 'away'
                    })}
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </div>
              )}
            </PropertySection>

            {/* VISIBILITY SECTION - for controlling when component is shown */}
            <PropertySection title="VISIBILITY" sectionKey="visibility">
              <div className="property-field">
                <label>Visibility Path</label>
                <small style={{ color: '#888', display: 'block', marginBottom: '4px' }}>
                  Control when this component is shown based on game data
                </small>
                <select
                  value={component.props?.visibilityPath || ''}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: {
                      ...component.props,
                      visibilityPath: e.target.value || undefined
                    }
                  })}
                >
                  <option value="">Always Visible</option>
                  <optgroup label="Home Penalty State">
                    <option value="penaltySlots.home.isState0">Home: 0 Penalties</option>
                    <option value="penaltySlots.home.isState1">Home: 1 Penalty</option>
                    <option value="penaltySlots.home.isState2">Home: 2 Penalties</option>
                    <option value="penaltySlots.home.isState3">Home: 3 Penalties</option>
                  </optgroup>
                  <optgroup label="Away Penalty State">
                    <option value="penaltySlots.away.isState0">Away: 0 Penalties</option>
                    <option value="penaltySlots.away.isState1">Away: 1 Penalty</option>
                    <option value="penaltySlots.away.isState2">Away: 2 Penalties</option>
                    <option value="penaltySlots.away.isState3">Away: 3 Penalties</option>
                  </optgroup>
                  <optgroup label="Home Penalty Slot Active">
                    <option value="penaltySlots.home.slot0.active">Home Penalty 1 Active</option>
                    <option value="penaltySlots.home.slot1.active">Home Penalty 2 Active</option>
                    <option value="penaltySlots.home.slot2.active">Home Penalty 3 Active</option>
                  </optgroup>
                  <optgroup label="Away Penalty Slot Active">
                    <option value="penaltySlots.away.slot0.active">Away Penalty 1 Active</option>
                    <option value="penaltySlots.away.slot1.active">Away Penalty 2 Active</option>
                    <option value="penaltySlots.away.slot2.active">Away Penalty 3 Active</option>
                  </optgroup>
                  <optgroup label="Team State">
                    <option value="homeTeam.possession">Home Has Possession</option>
                    <option value="awayTeam.possession">Away Has Possession</option>
                    <option value="homeTeam.bonus">Home In Bonus</option>
                    <option value="awayTeam.bonus">Away In Bonus</option>
                  </optgroup>
                </select>
              </div>
            </PropertySection>

            {/* IMAGE SECTION */}
            <PropertySection title="IMAGE" sectionKey="image">
              <div className="property-field">
                <label>Category</label>
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value as Sport)}
                >
                  {AVAILABLE_SPORTS.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subsection selector - only shown if sport has subsections */}
              {sportHasSubsections && (
                <div className="property-field">
                  <label>Subsection</label>
                  <select
                    value={selectedSubsection || ''}
                    onChange={(e) => setSelectedSubsection(e.target.value || undefined)}
                  >
                    <option value="">Root Images Only</option>
                    {availableSubsections.map((subsection) => (
                      <option key={subsection} value={subsection}>
                        {subsection}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {getStateValue('imageSource', 'none') === 'local' && (
                <div className="property-field">
                  <label>Select Image ({availableImages.length} available)</label>
                  <select
                    value={getStateValue('imagePath', '')}
                    onChange={(e) => handleImageSelect(e.target.value)}
                  >
                    <option value="">
                      {imagesLoading ? 'Loading images...' : 'Select an image...'}
                    </option>
                    {availableImages.map((filename) => (
                      <option key={filename} value={getImagePath(filename, selectedSport, selectedSubsection)}>
                        {filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {getStateValue('imageSource', 'none') === 'url' && (
                <div className="property-field">
                  <label>Image URL</label>
                  <input
                    type="url"
                    key={`${component?.id}-imageUrl`}
                    defaultValue={getStateValue('imageUrl', '')}
                    placeholder="https://example.com/image.jpg"
                    onChange={(e) => handleStatePropsChange('imageUrl', e.target.value)}
                    onBlur={(e) => handleImageSelect(e.target.value, true)}
                  />
                </div>
              )}

              {(getStateValue('imageSource', 'none') === 'local' && getStateValue('imagePath', '')) ||
               (getStateValue('imageSource', 'none') === 'url' && getStateValue('imageUrl', '')) ? (
                <div className="property-field">
                  <label>Size Control</label>
                  <div className="image-size-buttons">
                    <button
                      className="native-resolution-btn"
                      onClick={() => {
                        const imageUrl = getStateValue('imageSource', 'none') === 'local'
                          ? getStateValue('imagePath', '')
                          : getStateValue('imageUrl', '');
                        
                        if (imageUrl) {
                          // Create a temporary image to get dimensions
                          const img = new Image();
                          img.onload = () => {
                            // Use native image dimensions directly in pixels
                            updateComponentWithScrollPreservation(component.id, {
                              size: {
                                width: img.naturalWidth,
                                height: img.naturalHeight
                              },
                              originalAspectRatio: img.naturalWidth / img.naturalHeight,
                              props: {
                                ...component.props,
                                // Clear all padding to avoid constraining the image
                                paddingTop: 0,
                                paddingRight: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                // Set objectFit to 'none' to display image at native resolution without scaling
                                objectFit: 'none',
                                // Set background to transparent to avoid background bleeding
                                backgroundColor: 'transparent'
                              }
                            });
                          };
                          img.onerror = () => {
                            console.error('Failed to load image for dimension detection:', imageUrl);
                          };
                          img.src = resolveImagePath(imageUrl);
                        }
                      }}
                    >
                      📐 Native Resolution
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Image Tint Color Section */}
              {component.props?.imageSource !== 'none' && (
                <>
                  <div className="property-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={getStateValue('useImageTint', false)}
                        onChange={(e) => {
                          // Set both properties at once to avoid timing issues
                          if (e.target.checked && !getStateValue('imageTintColor', null)) {
                            onUpdateComponent(component.id, {
                              props: {
                                ...component.props,
                                useImageTint: true,
                                imageTintColor: '#ffffff'
                              }
                            });
                          } else {
                            updateStateProps('useImageTint', e.target.checked);
                          }
                        }}
                        style={{ marginRight: '8px' }}
                      />
                      Enable Image Tint (Color Mask)
                    </label>
                  </div>

                  {getStateValue('useImageTint', false) && (
                    <>
                      <div className="property-field">
                        <label>
                          <input
                            type="checkbox"
                            checked={component?.useTeamColor || false}
                            onChange={(e) => {
                              onUpdateComponent(component.id, {
                                useTeamColor: e.target.checked,
                                teamColorSide: e.target.checked ? (component.teamColorSide || 'home') : undefined
                              });
                            }}
                            style={{ marginRight: '8px' }}
                          />
                          Use Team Color for Tint
                        </label>
                      </div>

                      {component?.useTeamColor && (
                        <div className="property-field">
                          <label>Team Color for Tint</label>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              onClick={() => {
                                onUpdateComponent(component.id, {
                                  teamColorSide: 'home'
                                });
                              }}
                              style={{
                                flex: 1,
                                padding: '8px',
                                border: component.teamColorSide === 'home' ? '2px solid #4CAF50' : '1px solid #444',
                                borderRadius: '4px',
                                backgroundColor: '#1a1a1a',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: component.teamColorSide === 'home' ? 'bold' : 'normal'
                              }}
                            >
                              <div style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: '#c41e3a',
                                borderRadius: '3px',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                              }} />
                              Home
                            </button>
                            <button
                              onClick={() => {
                                onUpdateComponent(component.id, {
                                  teamColorSide: 'away'
                                });
                              }}
                              style={{
                                flex: 1,
                                padding: '8px',
                                border: component.teamColorSide === 'away' ? '2px solid #4CAF50' : '1px solid #444',
                                borderRadius: '4px',
                                backgroundColor: '#1a1a1a',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: component.teamColorSide === 'away' ? 'bold' : 'normal'
                              }}
                            >
                              <div style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: '#003f7f',
                                borderRadius: '3px',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                              }} />
                              Away
                            </button>
                          </div>
                        </div>
                      )}

                      {!component?.useTeamColor && (
                        <>
                          {isDragging ? (
                            <StaticColorSwatch
                              label="Tint Color"
                              color={component?.props?.imageTintColor || '#ffffff'}
                            />
                          ) : (
                            component?.props?.imageTintColor ? (
                              <div className="property-field">
                                <ColorPicker
                                  key={`tint-${component.id}`}
                                  label="Tint Color"
                                  value={component.props.imageTintColor}
                                  onChange={(color) => {
                                    if (color) {
                                      updateStateProps('imageTintColor', color);
                                    }
                                  }}
                                />
                              </div>
                            ) : null
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Image Source selector at bottom */}
              <div className="property-field" style={{ marginTop: '12px', borderTop: '1px solid #444', paddingTop: '12px' }}>
                <label>Image Source</label>
                <select
                  value={getStateValue('imageSource', 'none')}
                  onChange={(e) => updateStateProps('imageSource', e.target.value)}
                >
                  <option value="none">No Image</option>
                  <option value="local">Local Image</option>
                  <option value="url">URL</option>
                </select>
              </div>
            </PropertySection>

            {/* BORDERS SECTION */}
            <PropertySection title="BORDERS" sectionKey="borders">
              <div className="property-grid">
                <div className="property-field">
                  <label>Border Width (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    defaultValue={getStateValue('borderWidth', 0)}
                    onChange={(e) => handleStatePropsChange('borderWidth', e.target.value)}
                    onBlur={(e) => handleStatePropsBlur('borderWidth', e.target.value)}
                  />
                </div>
                {isDragging ? (
                  <StaticColorSwatch 
                    label="Border Color" 
                    color={component?.props?.borderColor || '#ffffff'} 
                  />
                ) : (
                  <div className="property-field">
                    <ColorPicker
                      label="Border Color"
                      value={getStateValue('borderColor', '#ffffff')}
                      onChange={(color) => updateStateProps('borderColor', color)}
                    />
                  </div>
                )}
              </div>

              <h5>Individual Borders</h5>
              <div className="border-sides-grid">
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(getStateValue('borderTopWidth', getStateValue('borderWidth', 1))) !== 0 ? 'active' : ''}`}
                    onClick={() => {
                      const currentValue = getStateValue('borderTopWidth', getStateValue('borderWidth', 1));
                      updateStateProps('borderTopWidth', currentValue !== 0 ? 0 : (getStateValue('borderWidth', 1)));
                    }}
                  >
                    Top
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(getStateValue('borderBottomWidth', getStateValue('borderWidth', 1))) !== 0 ? 'active' : ''}`}
                    onClick={() => {
                      const currentValue = getStateValue('borderBottomWidth', getStateValue('borderWidth', 1));
                      updateStateProps('borderBottomWidth', currentValue !== 0 ? 0 : (getStateValue('borderWidth', 1)));
                    }}
                  >
                    Bottom
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(getStateValue('borderLeftWidth', getStateValue('borderWidth', 1))) !== 0 ? 'active' : ''}`}
                    onClick={() => {
                      const currentValue = getStateValue('borderLeftWidth', getStateValue('borderWidth', 1));
                      updateStateProps('borderLeftWidth', currentValue !== 0 ? 0 : (getStateValue('borderWidth', 1)));
                    }}
                  >
                    Left
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(getStateValue('borderRightWidth', getStateValue('borderWidth', 1))) !== 0 ? 'active' : ''}`}
                    onClick={() => {
                      const currentValue = getStateValue('borderRightWidth', getStateValue('borderWidth', 1));
                      updateStateProps('borderRightWidth', currentValue !== 0 ? 0 : (getStateValue('borderWidth', 1)));
                    }}
                  >
                    Right
                  </button>
                </div>
              </div>

              <div className="property-field">
                <label>Border Style</label>
                <select
                  value={getStateValue('borderStyle', 'solid')}
                  onChange={(e) => updateStateProps('borderStyle', e.target.value)}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="double">Double</option>
                  <option value="groove">Groove</option>
                  <option value="ridge">Ridge</option>
                  <option value="inset">Inset</option>
                  <option value="outset">Outset</option>
                </select>
              </div>

              <h5>Padding</h5>
              <div className="corner-radius-grid">
                <div className="corner-control">
                  <label>Top</label>
                  <div className="radius-input-group">
                    <button
                      className="radius-quick-button minus"
                      onClick={() => updateStateProps('paddingTop', Math.max(0, (getStateValue('paddingTop', 0)) - 10))}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('paddingTop', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('paddingTop', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('paddingTop', e.target.value)}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateStateProps('paddingTop', (getStateValue('paddingTop', 0)) + 10)}
                    >
                      +10
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>Right</label>
                  <div className="radius-input-group">
                    <button
                      className="radius-quick-button minus"
                      onClick={() => updateStateProps('paddingRight', Math.max(0, (getStateValue('paddingRight', 0)) - 10))}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('paddingRight', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('paddingRight', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('paddingRight', e.target.value)}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateStateProps('paddingRight', (getStateValue('paddingRight', 0)) + 10)}
                    >
                      +10
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>Bottom</label>
                  <div className="radius-input-group">
                    <button
                      className="radius-quick-button minus"
                      onClick={() => updateStateProps('paddingBottom', Math.max(0, (getStateValue('paddingBottom', 0)) - 10))}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('paddingBottom', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('paddingBottom', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('paddingBottom', e.target.value)}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateStateProps('paddingBottom', (getStateValue('paddingBottom', 0)) + 10)}
                    >
                      +10
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>Left</label>
                  <div className="radius-input-group">
                    <button
                      className="radius-quick-button minus"
                      onClick={() => updateStateProps('paddingLeft', Math.max(0, (getStateValue('paddingLeft', 0)) - 10))}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('paddingLeft', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('paddingLeft', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('paddingLeft', e.target.value)}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateStateProps('paddingLeft', (getStateValue('paddingLeft', 0)) + 10)}
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

              <h5>Corner Radius (px)</h5>
              <div className="corner-radius-grid">
                <div className="corner-control">
                  <label>↖ Top Left</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderTopLeftRadius', 0);
                        updateStateProps('borderTopLeftRadius', Math.max(0, currentValue - 25));
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('borderTopLeftRadius', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('borderTopLeftRadius', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('borderTopLeftRadius', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderTopLeftRadius', 0);
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateStateProps('borderTopLeftRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +25
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↗ Top Right</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderTopRightRadius', 0);
                        updateStateProps('borderTopRightRadius', Math.max(0, currentValue - 25));
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('borderTopRightRadius', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('borderTopRightRadius', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('borderTopRightRadius', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderTopRightRadius', 0);
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateStateProps('borderTopRightRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +25
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↙ Bottom Left</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomLeftRadius', 0);
                        updateStateProps('borderBottomLeftRadius', Math.max(0, currentValue - 25));
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('borderBottomLeftRadius', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('borderBottomLeftRadius', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('borderBottomLeftRadius', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomLeftRadius', 0);
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateStateProps('borderBottomLeftRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +25
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↘ Bottom Right</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomRightRadius', 0);
                        updateStateProps('borderBottomRightRadius', Math.max(0, currentValue - 25));
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      defaultValue={getStateValue('borderBottomRightRadius', 0)}
                      min="0"
                      max="100"
                      onChange={(e) => handleStatePropsChange('borderBottomRightRadius', e.target.value)}
                      onBlur={(e) => handleStatePropsBlur('borderBottomRightRadius', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomRightRadius', 0);
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateStateProps('borderBottomRightRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +25
                    </button>
                  </div>
                </div>
              </div>
            </PropertySection>

            {/* SHADER EFFECTS SECTION */}
            <PropertySection title="SHADER EFFECTS" sectionKey="effects">
              <EffectPropertySection
                effectConfig={component.props?.effect as EffectConfig | undefined}
                componentId={component.id}
                onConfigChange={(config) => {
                  updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, effect: config }
                  });
                }}
                onPreview={(compId, effectName, options) => {
                  if (onPreviewEffect) {
                    onPreviewEffect(compId, effectName, options);
                  }
                }}
                teamColors={{
                  home: gameData?.homeTeam?.color || gameData?.home_team_color || '#c41e3a',
                  away: gameData?.awayTeam?.color || gameData?.away_team_color || '#003f7f'
                }}
              />
            </PropertySection>
          </>
        )}

        {component.type === 'dynamicList' && (
          <>
            {/* DYNAMIC LIST SECTION */}
            <PropertySection title="DYNAMIC LIST DATA" sectionKey="dynamic-list-data">
              <div className="property-field">
                <label>Total Count Path</label>
                <select
                  value={component.props?.totalCountPath || 'none'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, totalCountPath: e.target.value === 'none' ? undefined : e.target.value }
                  })}
                >
                  <option value="none">Use Static Value</option>
                  <option value="timeoutsAllowed">Timeouts Allowed</option>
                  <option value="maxFouls">Max Fouls</option>
                  <option value="gameUpdate.timeouts_allowed">Timeouts Allowed (Game Rules)</option>
                </select>
              </div>

              <div className="property-field">
                <label>Active Count Path</label>
                <select
                  value={component.props?.activeCountPath || 'none'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, activeCountPath: e.target.value === 'none' ? undefined : e.target.value }
                  })}
                >
                  <option value="none">Use Static Value</option>
                  <optgroup label="Home Team">
                    <option value="homeTeam.timeouts">Home Timeouts</option>
                    <option value="homeTeam.fouls">Home Fouls</option>
                  </optgroup>
                  <optgroup label="Away Team">
                    <option value="awayTeam.timeouts">Away Timeouts</option>
                    <option value="awayTeam.fouls">Away Fouls</option>
                  </optgroup>
                </select>
              </div>

              <div className="property-field">
                <label>Total Count (Static)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  defaultValue={component.props?.totalCount || 5}
                  onChange={(e) => handleNumberChange('totalCount', e.target.value)}
                  onBlur={(e) => handleNumberBlur('totalCount', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Active Count (Static)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  defaultValue={component.props?.activeCount || 2}
                  onChange={(e) => handleNumberChange('activeCount', e.target.value)}
                  onBlur={(e) => handleNumberBlur('activeCount', e.target.value)}
                />
              </div>
            </PropertySection>

            {/* DYNAMIC LIST STYLING */}
            <PropertySection title="ACTIVE ITEMS" sectionKey="dynamic-list-active">
              <div className="property-field">
                <ColorPicker
                  label="Active Background"
                  value={component.props?.activeBackgroundColor || '#4CAF50'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, activeBackgroundColor: color }
                  })}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Active Text Color"
                  value={component.props?.activeTextColor || '#ffffff'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, activeTextColor: color }
                  })}
                />
              </div>
            </PropertySection>

            <PropertySection title="INACTIVE ITEMS" sectionKey="dynamic-list-inactive">
              <div className="property-field">
                <ColorPicker
                  label="Inactive Background"
                  value={component.props?.inactiveBackgroundColor || '#666666'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, inactiveBackgroundColor: color }
                  })}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Inactive Text Color"
                  value={component.props?.inactiveTextColor || '#ffffff'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, inactiveTextColor: color }
                  })}
                />
              </div>
            </PropertySection>

            <PropertySection title="SHARED BORDERS" sectionKey="dynamic-list-borders">
              <div className="property-field">
                <label>Border Width (All Items)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  defaultValue={component.props?.borderWidth || 0}
                  onChange={(e) => handleNumberChange('borderWidth', e.target.value)}
                  onBlur={(e) => handleNumberBlur('borderWidth', e.target.value)}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Border Color (All Items)"
                  value={component.props?.borderColor || '#ffffff'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, borderColor: color }
                  })}
                />
              </div>
            </PropertySection>

            <PropertySection title="LAYOUT" sectionKey="dynamic-list-layout">
              <div className="property-field">
                <label>Direction</label>
                <select
                  value={component.props?.direction || 'horizontal'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, direction: e.target.value }
                  })}
                >
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
              </div>

              <div className="property-field">
                <label>Item Spacing</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  defaultValue={component.props?.itemSpacing || 4}
                  onChange={(e) => handleNumberChange('itemSpacing', e.target.value)}
                  onBlur={(e) => handleNumberBlur('itemSpacing', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Border Radius</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  defaultValue={component.props?.borderRadius || 4}
                  onChange={(e) => handleNumberChange('borderRadius', e.target.value)}
                  onBlur={(e) => handleNumberBlur('borderRadius', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.showNumbers || false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, showNumbers: e.target.checked }
                    })}
                  />
                  Show Numbers
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.reverseOrder || false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, reverseOrder: e.target.checked }
                    })}
                  />
                  Reverse Order (for timeouts)
                </label>
              </div>
            </PropertySection>

            {/* SHADER EFFECTS SECTION */}
            <PropertySection title="SHADER EFFECTS" sectionKey="effects">
              <EffectPropertySection
                effectConfig={component.props?.effect as EffectConfig | undefined}
                componentId={component.id}
                onConfigChange={(config) => {
                  updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, effect: config }
                  });
                }}
                onPreview={(compId, effectName, options) => {
                  if (onPreviewEffect) {
                    onPreviewEffect(compId, effectName, options);
                  }
                }}
                teamColors={{
                  home: gameData?.homeTeam?.color || gameData?.home_team_color || '#c41e3a',
                  away: gameData?.awayTeam?.color || gameData?.away_team_color || '#003f7f'
                }}
              />
            </PropertySection>
          </>
        )}

        {/* GROUP VISIBILITY SETTINGS */}
        {component.type === 'group' && (
          <>
            <PropertySection title="GROUP VISIBILITY" sectionKey="group-visibility">
              <div className="property-field">
                <label>Visibility Path</label>
                <small style={{ color: '#888', display: 'block', marginBottom: '4px' }}>
                  Show/hide all children based on a data value
                </small>
                <select
                  value={component.props?.visibilityPath || ''}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, visibilityPath: e.target.value || undefined }
                  })}
                >
                  <option value="">Always Visible</option>
                  <optgroup label="Home Penalty State">
                    <option value="penaltySlots.home.isState0">Home: 0 Penalties</option>
                    <option value="penaltySlots.home.isState1">Home: 1 Penalty</option>
                    <option value="penaltySlots.home.isState2">Home: 2 Penalties</option>
                    <option value="penaltySlots.home.isState3">Home: 3 Penalties</option>
                  </optgroup>
                  <optgroup label="Away Penalty State">
                    <option value="penaltySlots.away.isState0">Away: 0 Penalties</option>
                    <option value="penaltySlots.away.isState1">Away: 1 Penalty</option>
                    <option value="penaltySlots.away.isState2">Away: 2 Penalties</option>
                    <option value="penaltySlots.away.isState3">Away: 3 Penalties</option>
                  </optgroup>
                  <optgroup label="Home Penalty Slot Active">
                    <option value="penaltySlots.home.slot0.active">Home Penalty 1 Active</option>
                    <option value="penaltySlots.home.slot1.active">Home Penalty 2 Active</option>
                    <option value="penaltySlots.home.slot2.active">Home Penalty 3 Active</option>
                  </optgroup>
                  <optgroup label="Away Penalty Slot Active">
                    <option value="penaltySlots.away.slot0.active">Away Penalty 1 Active</option>
                    <option value="penaltySlots.away.slot1.active">Away Penalty 2 Active</option>
                    <option value="penaltySlots.away.slot2.active">Away Penalty 3 Active</option>
                  </optgroup>
                  <optgroup label="Team State">
                    <option value="homeTeam.possession">Home Has Possession</option>
                    <option value="awayTeam.possession">Away Has Possession</option>
                    <option value="homeTeam.bonus">Home In Bonus</option>
                    <option value="awayTeam.bonus">Away In Bonus</option>
                  </optgroup>
                </select>
              </div>
            </PropertySection>
          </>
        )}

      </div>
    </div>
  );
}

export default PropertyPanel;