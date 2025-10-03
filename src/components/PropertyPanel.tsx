import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import { loadAvailableImages, getAvailableImages, getImagePath, AVAILABLE_SPORTS, Sport } from '../utils/imageUtils';
import ColorPicker from './ColorPicker';
import './PropertyPanel.css';

interface PropertyPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onUpdateLayout: (layout: LayoutConfig) => void;
  gameData?: any;
  onUpdateGameData?: (gameData: any) => void;
}


// Simple number input handlers - no complex hook needed

function PropertyPanel({
  layout,
  selectedComponents,
  onUpdateComponent,
  onUpdateLayout,
  gameData,
  onUpdateGameData
}: PropertyPanelProps) {
  // Skip heavy computation during drag operations to improve performance
  const [isDragging, setIsDragging] = useState(false);
  
  // State for dynamically loaded images
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<Sport>('general');
  
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

  // Load available images on mount and when sport changes
  useEffect(() => {
    const loadImages = async () => {
      setImagesLoading(true);
      try {
        const images = await loadAvailableImages(selectedSport);
        setAvailableImages(images);
      } catch (error) {
        console.error('Failed to load images:', error);
        // Fallback to static list
        setAvailableImages(['universal-stub.png', 'face.png', 'clock-node.png']);
      } finally {
        setImagesLoading(false);
      }
    };

    loadImages();
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
  
  // State for collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
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
  
  // Save scroll position before updates
  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  };
  
  // Restore scroll position after updates
  const restoreScrollPosition = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  };
  
  // Save scroll position on every scroll
  const handleScroll = () => {
    saveScrollPosition();
  };
  
  // Restore scroll position when component changes or after prop updates
  useEffect(() => {
    restoreScrollPosition();
  }, [componentId]); // Restore when component changes

  // Also restore scroll position after component props change
  useEffect(() => {
    restoreScrollPosition();
  }, [component]); // Restore when component props change

  // Wrapped update function that preserves scroll position
  const updateComponentWithScrollPreservation = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    saveScrollPosition();
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
          className="section-header" 
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


  if (selectedComponents.length === 0) {
    return (
      <div className="property-panel">
        <div className="property-header">
          <h3>Properties</h3>
        </div>
        <div className="property-content">
          <div className="no-selection">
            Select a component to edit its properties
          </div>
        </div>
      </div>
    );
  }

  if (selectedComponents.length > 1) {
    const multiComponents = selectedComponents
      .map(id => layout.components.find(c => c.id === id))
      .filter((c): c is ComponentConfig => c !== undefined);

    return (
      <div className="property-panel">
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
                    {component.type === 'custom' ? '📦' :
                     component.type === 'dynamicList' ? '📋' : '🏷️'}
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
      <div className="property-panel">
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
    <div className="property-panel">
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
        <label>Display Name:</label>
        <input
          type="text"
          value={component.displayName || ''}
          onChange={(e) => updateComponentWithScrollPreservation(component.id, { 
            displayName: e.target.value 
          })}
          placeholder={`${component.type} component`}
        />
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
                onChange={(e) => handleNumberChange('x', e.target.value)}
                onBlur={(e) => handleNumberBlur('x', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Y (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.position.y) : 0}
                onChange={(e) => handleNumberChange('y', e.target.value)}
                onBlur={(e) => handleNumberBlur('y', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Width (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.size.width) : 0}
                onChange={(e) => handleNumberChange('width', e.target.value)}
                onBlur={(e) => handleNumberBlur('width', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Height (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round(component.size.height) : 0}
                onChange={(e) => handleNumberChange('height', e.target.value)}
                onBlur={(e) => handleNumberBlur('height', e.target.value)}
              />
            </div>
            {/* Layer control */}
            <div className="property-field">
              <label>Layer</label>
              <div className="radius-input-group">
                <button
                  className="radius-quick-button minus"
                  title="Move Behind"
                  onClick={() => {
                    const currentLayer = component.layer || 0;
                    updateComponentWithScrollPreservation(component.id, { layer: currentLayer - 1 });
                  }}
                >
                  -1
                </button>
                <input
                  type="number"
                  defaultValue={component ? (component.layer || 0) : 0}
                  onChange={(e) => handleNumberChange('layer', e.target.value)}
                  onBlur={(e) => handleNumberBlur('layer', e.target.value)}
                />
                <button
                  className="radius-quick-button"
                  title="Move Front"
                  onClick={() => {
                    const currentLayer = component.layer || 0;
                    updateComponentWithScrollPreservation(component.id, { layer: currentLayer + 1 });
                  }}
                >
                  +1
                </button>
              </div>
            </div>
          </div>
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
                    <option value="period">Period/Quarter</option>
                    <option value="isOvertime">Overtime</option>
                    <option value="home_sets_won">Home Sets Won</option>
                    <option value="away_sets_won">Away Sets Won</option>
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
                  <optgroup label="Sponsorship">
                    <option value="user_sequences.banner">Banner Ads</option>
                    <option value="user_sequences.timeout">Timeout Ads</option>
                  </optgroup>
                </select>
              </div>

              <div className="property-field">
                <label>Format Type</label>
                <select
                  value={getStateValue('format', 'text')}
                  onChange={(e) => updateStateProps('format', e.target.value)}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="time">Time</option>
                  <option value="boolean">Yes/No</option>
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
                      <ColorPicker
                        label="Background Color"
                        value={getStateValue('backgroundColor', '#000000')}
                        onChange={(color) => updateStateProps('backgroundColor', color)}
                      />
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

              {/* Toggle Controls */}
              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component?.props?.canToggle || false}
                    onChange={(e) => component && updateComponentWithScrollPreservation(component.id, {
                      props: {
                        ...component.props,
                        canToggle: e.target.checked,
                        toggleState: false, // Initialize toggle state to off
                        // Initialize state properties if not present
                        state1Props: component.props?.state1Props || {},
                        state2Props: component.props?.state2Props || {}
                      }
                    })}
                  />
                  Can Toggle
                </label>
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

              <h5>Image</h5>
              <div className="property-field">
                <label>Sport Category</label>
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value as Sport)}
                >
                  <option value="general">General</option>
                  <option value="basketball">Basketball</option>
                  <option value="break">Break</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="wrestling">Wrestling</option>
                </select>
              </div>
              <div className="property-field">
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

              {getStateValue('imageSource', 'none') === 'local' && (
                <>
                  <div className="property-field">
                    <label>Image Type</label>
                    <select
                      value={selectedSport}
                      onChange={(e) => setSelectedSport(e.target.value as Sport)}
                    >
                      <option value="general">General</option>
                      <option value="basketball">Basketball</option>
                      <option value="break">Break</option>
                      <option value="volleyball">Volleyball</option>
                      <option value="wrestling">Wrestling</option>
                    </select>
                  </div>
                  <div className="property-field">
                    <label>Select Image</label>
                    <select
                      value={getStateValue('imagePath', '')}
                      onChange={(e) => updateStateProps('imagePath', e.target.value)}
                    >
                      <option value="">
                        {imagesLoading ? 'Loading images...' : 'Select an image...'}
                      </option>
                      {availableImages.map((filename) => (
                        <option key={filename} value={getImagePath(filename, selectedSport)}>
                          {filename}
                        </option>
                      ))}
                    </select>
                  <button
                    type="button"
                    onClick={async () => {
                      setImagesLoading(true);
                      try {
                        const images = await loadAvailableImages(selectedSport);
                        setAvailableImages(images);
                      } catch (error) {
                        console.error('Failed to reload images:', error);
                      } finally {
                        setImagesLoading(false);
                      }
                    }}
                    disabled={imagesLoading}
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#333',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      cursor: imagesLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {imagesLoading ? 'Loading...' : 'Refresh Images'}
                  </button>
                </div>
                </>
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
                    onBlur={(e) => handleStatePropsBlur('imageUrl', e.target.value)}
                  />
                </div>
              )}

              {component.props?.imageSource !== 'none' && (
                <div className="property-field">
                  <label>Image Anchor Point</label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '4px',
                    marginTop: '4px' 
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Setting imageAnchor to top-left');
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, imageAnchor: 'top-left' }
                        });
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '10px',
                        backgroundColor: component.props?.imageAnchor === 'top-left' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Top Left"
                    >
                      ⬉
                    </button>
                    <button
                      type="button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, imageAnchor: 'top-right' }
                      })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '10px',
                        backgroundColor: component.props?.imageAnchor === 'top-right' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Top Right"
                    >
                      ⬈
                    </button>
                    <div></div>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Setting imageAnchor to center');
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, imageAnchor: 'center' }
                        });
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '10px',
                        backgroundColor: component.props?.imageAnchor === 'center' || !component.props?.imageAnchor ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        gridColumn: '2'
                      }}
                      title="Center"
                    >
                      ⬛
                    </button>
                    <div></div>
                    <button
                      type="button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, imageAnchor: 'bottom-left' }
                      })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '10px',
                        backgroundColor: component.props?.imageAnchor === 'bottom-left' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Bottom Left"
                    >
                      ⬋
                    </button>
                    <button
                      type="button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, imageAnchor: 'bottom-right' }
                      })}
                      style={{
                        padding: '8px 4px',
                        fontSize: '10px',
                        backgroundColor: component.props?.imageAnchor === 'bottom-right' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Bottom Right"
                    >
                      ⬊
                    </button>
                  </div>
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
                          img.src = imageUrl;
                        }
                      }}
                    >
                      📐 Native Resolution
                    </button>
                    
                    <button
                      className="crop-to-content-btn"
                      onClick={() => {
                        const imageUrl = getStateValue('imageSource', 'none') === 'local'
                          ? getStateValue('imagePath', '')
                          : getStateValue('imageUrl', '');
                        
                        if (imageUrl) {
                          // Create a temporary image to get dimensions
                          const img = new Image();
                          img.onload = () => {
                            const imageWidth = img.naturalWidth;
                            const imageHeight = img.naturalHeight;
                            const imageAspectRatio = imageWidth / imageHeight;
                            
                            // Component dimensions are already in pixels
                            const currentWidthPx = component.size.width;
                            
                            // Maintain the image's aspect ratio
                            const displayWidth = currentWidthPx;
                            const displayHeight = currentWidthPx / imageAspectRatio;
                            
                            updateComponentWithScrollPreservation(component.id, {
                              size: { 
                                width: Math.min(displayWidth, layout.dimensions.width),
                                height: Math.min(displayHeight, layout.dimensions.height)
                              },
                              props: {
                                ...component.props,
                                // Remove all padding to crop to content
                                paddingTop: 0,
                                paddingRight: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                // Set background to transparent so only image shows
                                backgroundColor: 'transparent'
                              }
                            });
                          };
                          img.onerror = () => {
                            console.error('Failed to load image for dimension detection:', imageUrl);
                          };
                          img.src = imageUrl;
                        }
                      }}
                    >
                      ✂️ Crop to Content
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
                                <label>Tint Color</label>
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

                      <div className="property-note" style={{
                        fontSize: '11px',
                        color: '#888',
                        marginTop: '4px',
                        padding: '8px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '4px'
                      }}>
                        💡 Tint overlays a color on white/transparent images. Works great for team color masks! Enable "Use Team Color" to automatically use team colors.
                      </div>
                    </>
                  )}
                </>
              )}
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
          </>
        )}

      </div>
    </div>
  );
}

export default PropertyPanel;