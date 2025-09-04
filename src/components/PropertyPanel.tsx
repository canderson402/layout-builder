import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import { getAvailableImages, getImagePath } from '../utils/imageUtils';
import ColorPicker from './ColorPicker';
import './PropertyPanel.css';

interface PropertyPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onUpdateLayout: (layout: LayoutConfig) => void;
}


// Simple number input handlers - no complex hook needed

function PropertyPanel({
  layout,
  selectedComponents,
  onUpdateComponent,
  onUpdateLayout: _onUpdateLayout // Prefix with underscore to indicate intentionally unused
}: PropertyPanelProps) {
  // Skip heavy computation during drag operations to improve performance
  const [isDragging, setIsDragging] = useState(false);
  
  // Create a frozen component reference that doesn't change during drag operations
  const [frozenComponent, setFrozenComponent] = useState<ComponentConfig | null>(null);
  
  // Update frozen component only when not dragging
  useEffect(() => {
    if (!isDragging) {
      const currentComponent = selectedComponents.length === 1 
        ? layout.components.find(c => c.id === selectedComponents[0]) || null
        : null;
      setFrozenComponent(currentComponent);
    }
  }, [layout.components, selectedComponents, isDragging]);
  
  // Use frozen component during drag, live component otherwise
  const component = isDragging ? frozenComponent : (
    selectedComponents.length === 1 
      ? layout.components.find(c => c.id === selectedComponents[0]) || null
      : null
  );

  // Create a stable component ID reference to prevent callback recreation
  const componentId = component?.id;
  
  // Local state for text inputs to prevent focus loss
  const [textInputs, setTextInputs] = useState({
    label: '',
    prefix: '',
    suffix: '',
    imageUrl: ''
  });
  
  // Track if we're currently editing to prevent external updates
  const [editingField, setEditingField] = useState<string | null>(null);
  
  // Update local text input state when component changes (but not when editing)
  React.useEffect(() => {
    if (component && !editingField) {
      setTextInputs({
        label: component.props?.label || '',
        prefix: component.props?.prefix || '',
        suffix: component.props?.suffix || '',
        imageUrl: component.props?.imageUrl || ''
      });
    }
  }, [component?.id, editingField]); // Remove specific prop dependencies to prevent updates during typing
  
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
      const percentValue = (pixelValue / layout.dimensions.width) * 100;
      updateComponentWithScrollPreservation(componentId, {
        position: { ...component.position, x: percentValue }
      });
    }
  }, [componentId, component, layout.dimensions.width]);

  const updateY = useCallback((pixelValue: number) => {
    if (component && componentId) {
      const percentValue = (pixelValue / layout.dimensions.height) * 100;
      updateComponentWithScrollPreservation(componentId, {
        position: { ...component.position, y: percentValue }
      });
    }
  }, [componentId, component, layout.dimensions.height]);

  const updateWidth = useCallback((pixelValue: number) => {
    if (component && componentId) {
      const percentValue = (pixelValue / layout.dimensions.width) * 100;
      updateComponentWithScrollPreservation(componentId, {
        size: { ...component.size, width: percentValue }
      });
    }
  }, [componentId, component, layout.dimensions.width]);

  const updateHeight = useCallback((pixelValue: number) => {
    if (component && componentId) {
      const percentValue = (pixelValue / layout.dimensions.height) * 100;
      updateComponentWithScrollPreservation(componentId, {
        size: { ...component.size, height: percentValue }
      });
    }
  }, [componentId, component, layout.dimensions.height]);

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
  
  // Text input handlers - MEMOIZED to prevent creating new functions on every render
  const handleTextInputFocus = useCallback((field: keyof typeof textInputs) => {
    setEditingField(field);
  }, []);

  const handleTextInputChange = useCallback((field: keyof typeof textInputs, value: string) => {
    setTextInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTextInputSubmit = useCallback((field: keyof typeof textInputs) => {
    if (component && componentId) {
      // Use functional update to get current textInputs without dependency
      setTextInputs(currentInputs => {
        // Use onUpdateComponent directly to avoid circular dependency
        onUpdateComponent(componentId, {
          props: { ...component.props, [field]: currentInputs[field] }
        });
        return currentInputs; // Don't actually change state
      });
    }
    setEditingField(null);
  }, [componentId, component, onUpdateComponent]);

  const handleTextInputBlur = useCallback((field: keyof typeof textInputs) => {
    handleTextInputSubmit(field);
  }, [handleTextInputSubmit]);

  const handleTextInputKeyDown = useCallback((field: keyof typeof textInputs, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextInputSubmit(field);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setTextInputs(prev => ({ 
        ...prev, 
        [field]: component?.props?.[field] || '' 
      }));
      setEditingField(null);
      (e.target as HTMLInputElement).blur();
    }
  }, [handleTextInputSubmit, component]);

  // Pre-bound handlers for each field to avoid inline functions
  const labelHandlers = useMemo(() => ({
    onFocus: () => handleTextInputFocus('label'),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleTextInputChange('label', e.target.value),
    onBlur: () => handleTextInputBlur('label'),
    onKeyDown: (e: React.KeyboardEvent) => handleTextInputKeyDown('label', e)
  }), [handleTextInputFocus, handleTextInputChange, handleTextInputBlur, handleTextInputKeyDown]);

  const prefixHandlers = useMemo(() => ({
    onFocus: () => handleTextInputFocus('prefix'),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleTextInputChange('prefix', e.target.value),
    onBlur: () => handleTextInputBlur('prefix'),
    onKeyDown: (e: React.KeyboardEvent) => handleTextInputKeyDown('prefix', e)
  }), [handleTextInputFocus, handleTextInputChange, handleTextInputBlur, handleTextInputKeyDown]);

  const suffixHandlers = useMemo(() => ({
    onFocus: () => handleTextInputFocus('suffix'),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleTextInputChange('suffix', e.target.value),
    onBlur: () => handleTextInputBlur('suffix'),
    onKeyDown: (e: React.KeyboardEvent) => handleTextInputKeyDown('suffix', e)
  }), [handleTextInputFocus, handleTextInputChange, handleTextInputBlur, handleTextInputKeyDown]);

  const imageUrlHandlers = useMemo(() => ({
    onFocus: () => handleTextInputFocus('imageUrl'),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleTextInputChange('imageUrl', e.target.value),
    onBlur: () => handleTextInputBlur('imageUrl'),
    onKeyDown: (e: React.KeyboardEvent) => handleTextInputKeyDown('imageUrl', e)
  }), [handleTextInputFocus, handleTextInputChange, handleTextInputBlur, handleTextInputKeyDown]);
  
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
  
  // Restore scroll position only when component changes or after updates
  useEffect(() => {
    restoreScrollPosition();
  }, [componentId]); // Only restore when component changes

  // Wrapped update function that preserves scroll position
  const updateComponentWithScrollPreservation = useCallback((id: string, updates: Partial<ComponentConfig>) => {
    saveScrollPosition();
    onUpdateComponent(id, updates);
  }, [onUpdateComponent]);
  
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
    return (
      <div className="property-panel">
        <div className="property-header">
          <h3>Properties</h3>
        </div>
        <div className="property-content">
          <div className="no-selection">
            Multiple components selected ({selectedComponents.length})
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
        <h3>{component.type} Properties</h3>
        {component.team && (
          <span className="team-badge">{component.team}</span>
        )}
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
                defaultValue={component ? Math.round((component.position.x / 100) * layout.dimensions.width) : 0}
                onChange={(e) => handleNumberChange('x', e.target.value)}
                onBlur={(e) => handleNumberBlur('x', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Y (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round((component.position.y / 100) * layout.dimensions.height) : 0}
                onChange={(e) => handleNumberChange('y', e.target.value)}
                onBlur={(e) => handleNumberBlur('y', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Width (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round((component.size.width / 100) * layout.dimensions.width) : 0}
                onChange={(e) => handleNumberChange('width', e.target.value)}
                onBlur={(e) => handleNumberBlur('width', e.target.value)}
              />
            </div>
            <div className="property-field">
              <label>Height (px)</label>
              <input
                type="number"
                defaultValue={component ? Math.round((component.size.height / 100) * layout.dimensions.height) : 0}
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
              defaultValue={component?.props?.fontSize || 24}
              onChange={(e) => handleNumberChange('fontSize', e.target.value)}
              onBlur={(e) => handleNumberBlur('fontSize', e.target.value)}
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
                value={component?.props?.textColor || '#ffffff'}
                onChange={(color) => component && updateComponentWithScrollPreservation(component.id, {
                  props: { ...component.props, textColor: color }
                })}
              />
            </div>
          )}
          
          <div className="property-field">
            <label>Text Alignment</label>
            <select
              value={component.props?.textAlign || 'center'}
              onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                props: { ...component.props, textAlign: e.target.value }
              })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          {component.props?.label !== undefined && (
            <div className="property-field">
              <label>Label</label>
              <input
                type="text"
                value={textInputs.label}
                {...labelHandlers}
              />
            </div>
          )}

          {component.props?.maxTimeouts !== undefined && (
            <div className="property-field">
              <label>Max Timeouts</label>
              <input
                type="number"
                value={component.props.maxTimeouts}
                min="1"
                max="10"
                onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                  props: { ...component.props, maxTimeouts: parseInt(e.target.value) || 5 }
                })}
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
                  value={component.props?.dataPath || 'gameClock'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, dataPath: e.target.value }
                  })}
                >
                  <optgroup label="Game Info">
                    <option value="gameClock">Game Clock</option>
                    <option value="period">Period/Quarter</option>
                    <option value="shotClock">Shot Clock</option>
                    <option value="quarter">Quarter</option>
                    <option value="half">Half</option>
                    <option value="set">Set</option>
                    <option value="isOvertime">Overtime</option>
                  </optgroup>
                  <optgroup label="Home Team">
                    <option value="homeTeam.name">Home Team Name</option>
                    <option value="homeTeam.score">Home Score</option>
                    <option value="homeTeam.fouls">Home Fouls</option>
                    <option value="homeTeam.timeouts">Home Timeouts</option>
                    <option value="homeTeam.bonus">Home Bonus</option>
                    <option value="homeTeam.possession">Home Possession</option>
                  </optgroup>
                  <optgroup label="Away Team">
                    <option value="awayTeam.name">Away Team Name</option>
                    <option value="awayTeam.score">Away Score</option>
                    <option value="awayTeam.fouls">Away Fouls</option>
                    <option value="awayTeam.timeouts">Away Timeouts</option>
                    <option value="awayTeam.bonus">Away Bonus</option>
                    <option value="awayTeam.possession">Away Possession</option>
                  </optgroup>
                </select>
              </div>


              <div className="property-field">
                <label>Format Type</label>
                <select
                  value={component.props?.format || 'text'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, format: e.target.value }
                  })}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="time">Time</option>
                  <option value="boolean">Yes/No</option>
                </select>
              </div>

              <div className="property-grid">
                <div className="property-field">
                  <label>Prefix</label>
                  <input
                    type="text"
                    value={textInputs.prefix}
                    placeholder="e.g., '$', '#'"
                    {...prefixHandlers}
                  />
                </div>
                <div className="property-field">
                  <label>Suffix</label>
                  <input
                    type="text"
                    value={textInputs.suffix}
                    placeholder="e.g., 'pts', '%'"
                    {...suffixHandlers}
                  />
                </div>
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
                        value={component?.props?.backgroundColor || '#000000'}
                        onChange={(color) => component && updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, backgroundColor: color }
                        })}
                      />
                    </div>
                    <div className="property-field">
                      <ColorPicker
                        label="Text Color"
                        value={component?.props?.textColor || '#ffffff'}
                        onChange={(color) => component && updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, textColor: color }
                        })}
                      />
                    </div>
                  </>
                )}
              </div>

              <h5>Image</h5>
              <div className="property-field">
                <label>Image Source</label>
                <select
                  value={component.props?.imageSource || 'none'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, imageSource: e.target.value }
                  })}
                >
                  <option value="none">No Image</option>
                  <option value="local">Local Image</option>
                  <option value="url">URL</option>
                </select>
              </div>

              {component.props?.imageSource === 'local' && (
                <div className="property-field">
                  <label>Select Image</label>
                  <select
                    value={component.props?.imagePath || ''}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, imagePath: e.target.value }
                    })}
                  >
                    <option value="">Select an image...</option>
                    {getAvailableImages().map((filename) => (
                      <option key={filename} value={getImagePath(filename)}>
                        {filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {component.props?.imageSource === 'url' && (
                <div className="property-field">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={textInputs.imageUrl}
                    placeholder="https://example.com/image.jpg"
                    {...imageUrlHandlers}
                  />
                </div>
              )}

              {(component.props?.imageSource === 'local' && component.props?.imagePath) || 
               (component.props?.imageSource === 'url' && component.props?.imageUrl) ? (
                <div className="property-field">
                  <label>Size Control</label>
                  <div className="image-size-buttons">
                    <button
                      className="native-resolution-btn"
                      onClick={() => {
                        const imageUrl = component.props?.imageSource === 'local' 
                          ? component.props?.imagePath 
                          : component.props?.imageUrl;
                        
                        if (imageUrl) {
                          // Create a temporary image to get dimensions
                          const img = new Image();
                          img.onload = () => {
                            // Convert pixels to percentage based on layout dimensions
                            const widthPercent = (img.naturalWidth / layout.dimensions.width) * 100;
                            const heightPercent = (img.naturalHeight / layout.dimensions.height) * 100;
                            
                            updateComponentWithScrollPreservation(component.id, {
                              size: { 
                                width: widthPercent,
                                height: heightPercent
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
                        const imageUrl = component.props?.imageSource === 'local' 
                          ? component.props?.imagePath 
                          : component.props?.imageUrl;
                        
                        if (imageUrl) {
                          // Create a temporary image to get dimensions
                          const img = new Image();
                          img.onload = () => {
                            const imageWidth = img.naturalWidth;
                            const imageHeight = img.naturalHeight;
                            const imageAspectRatio = imageWidth / imageHeight;
                            
                            // Get current component dimensions in pixels
                            const currentWidthPx = (component.size.width / 100) * layout.dimensions.width;
                            // const currentHeightPx = (component.size.height / 100) * layout.dimensions.height; // Removed unused variable
                            
                            // Since we use object-fit: fill, we want to maintain the image's aspect ratio
                            // while keeping a reasonable size. We'll use the current width and calculate height.
                            const displayWidth = currentWidthPx;
                            const displayHeight = currentWidthPx / imageAspectRatio;
                            
                            // Convert back to percentages
                            const widthPercent = (displayWidth / layout.dimensions.width) * 100;
                            const heightPercent = (displayHeight / layout.dimensions.height) * 100;
                            
                            updateComponentWithScrollPreservation(component.id, {
                              size: { 
                                width: Math.min(widthPercent, 100),
                                height: Math.min(heightPercent, 100)
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
                    defaultValue={component ? (component.props?.borderWidth || 0) : 0}
                    onChange={(e) => handleNumberChange('borderWidth', e.target.value)}
                    onBlur={(e) => handleNumberBlur('borderWidth', e.target.value)}
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
                      value={component?.props?.borderColor || '#ffffff'}
                      onChange={(color) => component && updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, borderColor: color }
                      })}
                    />
                  </div>
                )}
              </div>

              <h5>Individual Borders</h5>
              <div className="border-sides-grid">
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(component.props?.borderTopWidth !== undefined ? component.props?.borderTopWidth : (component.props?.borderWidth || 1)) !== 0 ? 'active' : ''}`}
                    onClick={() => updateComponentWithScrollPreservation(component.id, {
                      props: { 
                        ...component.props, 
                        borderTopWidth: (component.props?.borderTopWidth !== undefined ? component.props?.borderTopWidth : (component.props?.borderWidth || 1)) !== 0 ? 0 : (component.props?.borderWidth || 1)
                      }
                    })}
                  >
                    Top
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(component.props?.borderBottomWidth !== undefined ? component.props?.borderBottomWidth : (component.props?.borderWidth || 1)) !== 0 ? 'active' : ''}`}
                    onClick={() => updateComponentWithScrollPreservation(component.id, {
                      props: { 
                        ...component.props, 
                        borderBottomWidth: (component.props?.borderBottomWidth !== undefined ? component.props?.borderBottomWidth : (component.props?.borderWidth || 1)) !== 0 ? 0 : (component.props?.borderWidth || 1)
                      }
                    })}
                  >
                    Bottom
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(component.props?.borderLeftWidth !== undefined ? component.props?.borderLeftWidth : (component.props?.borderWidth || 1)) !== 0 ? 'active' : ''}`}
                    onClick={() => updateComponentWithScrollPreservation(component.id, {
                      props: { 
                        ...component.props, 
                        borderLeftWidth: (component.props?.borderLeftWidth !== undefined ? component.props?.borderLeftWidth : (component.props?.borderWidth || 1)) !== 0 ? 0 : (component.props?.borderWidth || 1)
                      }
                    })}
                  >
                    Left
                  </button>
                </div>
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(component.props?.borderRightWidth !== undefined ? component.props?.borderRightWidth : (component.props?.borderWidth || 1)) !== 0 ? 'active' : ''}`}
                    onClick={() => updateComponentWithScrollPreservation(component.id, {
                      props: { 
                        ...component.props, 
                        borderRightWidth: (component.props?.borderRightWidth !== undefined ? component.props?.borderRightWidth : (component.props?.borderWidth || 1)) !== 0 ? 0 : (component.props?.borderWidth || 1)
                      }
                    })}
                  >
                    Right
                  </button>
                </div>
              </div>

              <div className="property-field">
                <label>Border Style</label>
                <select
                  value={component.props?.borderStyle || 'solid'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, borderStyle: e.target.value }
                  })}
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
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingTop: Math.max(0, (component.props?.paddingTop || 0) - 10)
                        }
                      })}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      value={component.props?.paddingTop || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, paddingTop: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingTop: (component.props?.paddingTop || 0) + 10
                        }
                      })}
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
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingRight: Math.max(0, (component.props?.paddingRight || 0) - 10)
                        }
                      })}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      value={component.props?.paddingRight || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, paddingRight: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingRight: (component.props?.paddingRight || 0) + 10
                        }
                      })}
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
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingBottom: Math.max(0, (component.props?.paddingBottom || 0) - 10)
                        }
                      })}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      value={component.props?.paddingBottom || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, paddingBottom: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingBottom: (component.props?.paddingBottom || 0) + 10
                        }
                      })}
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
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingLeft: Math.max(0, (component.props?.paddingLeft || 0) - 10)
                        }
                      })}
                    >
                      -10
                    </button>
                    <input
                      type="number"
                      value={component.props?.paddingLeft || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, paddingLeft: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => updateComponentWithScrollPreservation(component.id, {
                        props: { 
                          ...component.props, 
                          paddingLeft: (component.props?.paddingLeft || 0) + 10
                        }
                      })}
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
                        const currentValue = component.props?.borderTopLeftRadius || 0;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderTopLeftRadius: Math.max(0, currentValue - 25) }
                        });
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      value={component.props?.borderTopLeftRadius || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, borderTopLeftRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderTopLeftRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderTopLeftRadius: nextValue }
                        });
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
                        const currentValue = component.props?.borderTopRightRadius || 0;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderTopRightRadius: Math.max(0, currentValue - 25) }
                        });
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      value={component.props?.borderTopRightRadius || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, borderTopRightRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderTopRightRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderTopRightRadius: nextValue }
                        });
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
                        const currentValue = component.props?.borderBottomLeftRadius || 0;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderBottomLeftRadius: Math.max(0, currentValue - 25) }
                        });
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      value={component.props?.borderBottomLeftRadius || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, borderBottomLeftRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderBottomLeftRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderBottomLeftRadius: nextValue }
                        });
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
                        const currentValue = component.props?.borderBottomRightRadius || 0;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderBottomRightRadius: Math.max(0, currentValue - 25) }
                        });
                      }}
                      className="radius-quick-button minus"
                    >
                      -25
                    </button>
                    <input
                      type="number"
                      value={component.props?.borderBottomRightRadius || 0}
                      min="0"
                      max="100"
                      onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                        props: { ...component.props, borderBottomRightRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderBottomRightRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        updateComponentWithScrollPreservation(component.id, {
                          props: { ...component.props, borderBottomRightRadius: nextValue }
                        });
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

      </div>
    </div>
  );
}

export default PropertyPanel;