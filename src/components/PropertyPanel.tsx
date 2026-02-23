import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { ComponentConfig, LayoutConfig, SlotTemplate } from '../types';
import { loadTemplates, saveTemplates } from '../utils/slotTemplates';
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
}

// Width threshold for two-column layout
const TWO_COLUMN_THRESHOLD = 450;

// Collapsible section component for game data - defined outside to prevent re-creation on render
const GameDataSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
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

// Reusable debounced input component - prevents form reset on every keystroke
// Uses local state and only commits on blur or Enter
interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onCommit: (value: string) => void;
}

const DebouncedInput = React.memo(({ value, onCommit, ...props }: DebouncedInputProps) => {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync local state when external value changes (e.g., different component selected)
  // But only if the input isn't focused (user isn't actively typing)
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  const handleBlur = React.useCallback(() => {
    onCommit(localValue);
  }, [localValue, onCommit]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCommit(localValue);
      inputRef.current?.blur();
    }
  }, [localValue, onCommit]);

  return (
    <input
      ref={inputRef}
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
});

DebouncedInput.displayName = 'DebouncedInput';

function PropertyPanel({
  layout,
  selectedComponents,
  onUpdateComponent,
  onUpdateLayout,
  gameData,
  onUpdateGameData,
  panelWidth = 320
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

  // Slot templates state - refresh whenever selection changes
  const [slotTemplates, setSlotTemplates] = useState<SlotTemplate[]>(() => loadTemplates());

  // Refresh templates whenever component selection changes
  useEffect(() => {
    setSlotTemplates(loadTemplates());
  }, [selectedComponents]);

  // Helper to calculate and update slotList size based on template and props
  const updateSlotListSize = useCallback((
    componentId: string,
    templateId: string | undefined,
    slotCount: number,
    slotSpacing: number,
    direction: 'vertical' | 'horizontal'
  ) => {
    if (!templateId) return;
    const template = slotTemplates.find(t => t.id === templateId);
    if (!template) return;

    const naturalWidth = direction === 'horizontal'
      ? slotCount * template.slotSize.width + (slotCount - 1) * slotSpacing
      : template.slotSize.width;
    const naturalHeight = direction === 'vertical'
      ? slotCount * template.slotSize.height + (slotCount - 1) * slotSpacing
      : template.slotSize.height;

    onUpdateComponent(componentId, {
      size: { width: naturalWidth, height: naturalHeight }
    });
  }, [slotTemplates, onUpdateComponent]);

  // Auto-sync slotList sizes when templates change
  useEffect(() => {
    const slotListComponents = (layout.components || []).filter(c => c.type === 'slotList');
    slotListComponents.forEach(comp => {
      const templateId = comp.props?.templateId;
      if (!templateId) return;
      const template = slotTemplates.find(t => t.id === templateId);
      if (!template) return;

      const slotCount = comp.props?.slotCount || 5;
      const slotSpacing = comp.props?.slotSpacing || 5;
      const direction = comp.props?.direction || 'vertical';

      const naturalWidth = direction === 'horizontal'
        ? slotCount * template.slotSize.width + (slotCount - 1) * slotSpacing
        : template.slotSize.width;
      const naturalHeight = direction === 'vertical'
        ? slotCount * template.slotSize.height + (slotCount - 1) * slotSpacing
        : template.slotSize.height;

      // Only update if size is different
      if (comp.size.width !== naturalWidth || comp.size.height !== naturalHeight) {
        onUpdateComponent(comp.id, {
          size: { width: naturalWidth, height: naturalHeight }
        });
      }
    });
  }, [slotTemplates, layout.components, onUpdateComponent]);

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
    'dynamic-list-layout',
    'leaderboard-display',
    'leaderboard-styling',
    'leaderboard-cycling'
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
        // Don't auto-lock aspect ratio - user can lock it manually if needed
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

  // Helper to update leaderboard count for preview
  const updateLeaderboardCount = (team: 'home' | 'away', count: number) => {
    if (!onUpdateGameData || !gameData) return;

    const newGameData = { ...gameData };
    const slots = newGameData.leaderboardSlots?.[team] || {};

    newGameData.leaderboardSlots = {
      ...newGameData.leaderboardSlots,
      [team]: {
        ...slots,
        count,
        isState0: count === 0,
        isState1: count === 1,
        isState2: count === 2,
        isState3: count === 3,
        isState4: count === 4,
        isState5: count >= 5,
        slot0: { ...slots.slot0, active: count >= 1 },
        slot1: { ...slots.slot1, active: count >= 2 },
        slot2: { ...slots.slot2, active: count >= 3 },
        slot3: { ...slots.slot3, active: count >= 4 },
        slot4: { ...slots.slot4, active: count >= 5 },
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

          {/* Leaderboard Slots */}
          <GameDataSection title="Leaderboard Slots">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
                Home Player Count
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => updateLeaderboardCount('home', count)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: gameData?.leaderboardSlots?.home?.count === count ? '#4CAF50' : '#333',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: gameData?.leaderboardSlots?.home?.count === count ? 'bold' : 'normal',
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
                Away Player Count
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => updateLeaderboardCount('away', count)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: gameData?.leaderboardSlots?.away?.count === count ? '#4CAF50' : '#333',
                      color: 'white',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: gameData?.leaderboardSlots?.away?.count === count ? 'bold' : 'normal',
                      fontSize: '14px'
                    }}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            {/* Leaderboard slot details */}
            {(gameData?.leaderboardSlots?.home?.count > 0 || gameData?.leaderboardSlots?.away?.count > 0) && (
              <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '11px' }}>
                <div style={{ color: '#888', marginBottom: '8px' }}>Leaderboard Slot Data:</div>
                {gameData?.leaderboardSlots?.home?.count > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#aaa', marginBottom: '4px' }}>Home:</div>
                    {[0, 1, 2, 3, 4].slice(0, gameData?.leaderboardSlots?.home?.count).map((i) => (
                      <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                        <input
                          placeholder="#"
                          value={gameData?.leaderboardSlots?.home?.[`slot${i}`]?.jersey || ''}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.home.slot${i}.jersey`, e.target.value)}
                          style={{ width: '36px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Name"
                          value={gameData?.leaderboardSlots?.home?.[`slot${i}`]?.name || ''}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.home.slot${i}.name`, e.target.value)}
                          style={{ flex: 2, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Pts"
                          type="number"
                          value={gameData?.leaderboardSlots?.home?.[`slot${i}`]?.points || 0}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.home.slot${i}.points`, parseInt(e.target.value) || 0)}
                          style={{ width: '40px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="F"
                          type="number"
                          value={gameData?.leaderboardSlots?.home?.[`slot${i}`]?.fouls || 0}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.home.slot${i}.fouls`, parseInt(e.target.value) || 0)}
                          style={{ width: '32px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#888', fontSize: '10px' }}>
                          <input
                            type="checkbox"
                            checked={gameData?.leaderboardSlots?.home?.[`slot${i}`]?.isTopScorer || false}
                            onChange={(e) => updateGameDataValue(`leaderboardSlots.home.slot${i}.isTopScorer`, e.target.checked)}
                          />
                          Top
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {gameData?.leaderboardSlots?.away?.count > 0 && (
                  <div>
                    <div style={{ color: '#aaa', marginBottom: '4px' }}>Away:</div>
                    {[0, 1, 2, 3, 4].slice(0, gameData?.leaderboardSlots?.away?.count).map((i) => (
                      <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                        <input
                          placeholder="#"
                          value={gameData?.leaderboardSlots?.away?.[`slot${i}`]?.jersey || ''}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.away.slot${i}.jersey`, e.target.value)}
                          style={{ width: '36px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Name"
                          value={gameData?.leaderboardSlots?.away?.[`slot${i}`]?.name || ''}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.away.slot${i}.name`, e.target.value)}
                          style={{ flex: 2, padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="Pts"
                          type="number"
                          value={gameData?.leaderboardSlots?.away?.[`slot${i}`]?.points || 0}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.away.slot${i}.points`, parseInt(e.target.value) || 0)}
                          style={{ width: '40px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <input
                          placeholder="F"
                          type="number"
                          value={gameData?.leaderboardSlots?.away?.[`slot${i}`]?.fouls || 0}
                          onChange={(e) => updateGameDataValue(`leaderboardSlots.away.slot${i}.fouls`, parseInt(e.target.value) || 0)}
                          style={{ width: '32px', padding: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '2px', color: 'white', fontSize: '11px' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#888', fontSize: '10px' }}>
                          <input
                            type="checkbox"
                            checked={gameData?.leaderboardSlots?.away?.[`slot${i}`]?.isTopScorer || false}
                            onChange={(e) => updateGameDataValue(`leaderboardSlots.away.slot${i}.isTopScorer`, e.target.checked)}
                          />
                          Top
                        </label>
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
                     component.type === 'dynamicList' ? '[L]' :
                     component.type === 'leaderboardList' ? '[LB]' : '[T]'}
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
          padding: '8px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
          {/* Auto Toggle - bind toggle state to dataPath boolean value */}
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={component.props?.autoToggle || false}
                onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                  props: { ...component.props, autoToggle: e.target.checked }
                })}
              />
              <span style={{ fontSize: '12px', color: '#fff' }}>Auto Toggle</span>
            </label>
            <small style={{ color: '#888', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              When enabled, the Data Path value controls the toggle state.
              Set Data Path to a boolean like <strong style={{ color: '#4CAF50' }}>isTopScorer</strong>.
            </small>
            {component.props?.autoToggle && (
              <small style={{ color: '#4CAF50', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
                State 1 = false, State 2 = true
              </small>
            )}
          </div>
        </div>
      )}
      
      {/* Display Name Field */}
      <div className="property-section">
        <div className="property-field">
          <label>Display Name</label>
          <DebouncedInput
            type="text"
            value={component.displayName || ''}
            onCommit={(val) => updateComponentWithScrollPreservation(component.id, {
              displayName: val
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
              <DebouncedInput
                type="number"
                value={component ? Math.round(component.position.x) : 0}
                onCommit={(val) => {
                  updateComponentWithScrollPreservation(component.id, {
                    position: { ...component.position, x: parseInt(val) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Y (px)</label>
              <DebouncedInput
                type="number"
                value={component ? Math.round(component.position.y) : 0}
                onCommit={(val) => {
                  updateComponentWithScrollPreservation(component.id, {
                    position: { ...component.position, y: parseInt(val) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Width (px)</label>
              <DebouncedInput
                type="number"
                value={component ? Math.round(component.size.width) : 0}
                onCommit={(val) => {
                  updateComponentWithScrollPreservation(component.id, {
                    size: { ...component.size, width: parseInt(val) || 0 }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Height (px)</label>
              <DebouncedInput
                type="number"
                value={component ? Math.round(component.size.height) : 0}
                onCommit={(val) => {
                  updateComponentWithScrollPreservation(component.id, {
                    size: { ...component.size, height: parseInt(val) || 0 }
                  });
                }}
              />
            </div>
          </div>

          {/* Scale Percentage Section */}
          <div className="property-field" style={{ marginTop: '12px' }}>
            <label>Scale %</label>
            {component?.originalSize ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DebouncedInput
                    type="number"
                    step="0.1"
                    style={{ width: '70px' }}
                    value={Math.round((component.size.width / component.originalSize.width) * 1000) / 10}
                    onCommit={(val) => {
                      const scale = (parseFloat(val) || 100) / 100;
                      updateComponentWithScrollPreservation(component.id, {
                        size: {
                          width: Math.round(component.originalSize!.width * scale),
                          height: Math.round(component.originalSize!.height * scale)
                        }
                      });
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => {
                          const scale = pct / 100;
                          updateComponentWithScrollPreservation(component.id, {
                            size: {
                              width: Math.round(component.originalSize!.width * scale),
                              height: Math.round(component.originalSize!.height * scale)
                            }
                          });
                        }}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          backgroundColor: Math.abs((component.size.width / component.originalSize.width) * 100 - pct) < 0.1 ? '#4CAF50' : '#444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                {/* Grid-aligned scale options (both dimensions divisible by 10) */}
                {(() => {
                  const w = component.originalSize.width;
                  const h = component.originalSize.height;

                  // Find scales where both w*scale and h*scale are divisible by 10
                  // Use GCD to find the denominator constraint for valid fractional scales
                  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                  const wDiv = w / gcd(w, 10);
                  const hDiv = h / gcd(h, 10);
                  const g = gcd(wDiv, hDiv);

                  // Generate valid percentages between 20% and 100%
                  const validScales: { pct: number; width: number; height: number }[] = [];
                  for (let n = 1; n <= g * 5; n++) {
                    const scale = n / g;
                    if (scale < 0.2 || scale > 1.0) continue;
                    const newW = Math.round(w * scale);
                    const newH = Math.round(h * scale);
                    if (newW % 10 === 0 && newH % 10 === 0) {
                      const pct = Math.round(scale * 10000) / 100; // Round to 2 decimal places
                      // Avoid duplicates
                      if (!validScales.some(s => Math.abs(s.pct - pct) < 0.01)) {
                        validScales.push({ pct, width: newW, height: newH });
                      }
                    }
                    if (validScales.length >= 8) break;
                  }

                  // Sort by percentage
                  validScales.sort((a, b) => a.pct - b.pct);

                  if (validScales.length === 0) return null;

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: '#666' }}>Grid (10px):</span>
                      {validScales.map(({ pct, width: newW, height: newH }) => {
                        const currentPct = Math.round((component.size.width / w) * 10000) / 100;
                        return (
                          <button
                            key={pct}
                            onClick={() => {
                              updateComponentWithScrollPreservation(component.id, {
                                size: { width: newW, height: newH }
                              });
                            }}
                            style={{
                              fontSize: '9px',
                              padding: '2px 4px',
                              backgroundColor: Math.abs(currentPct - pct) < 0.1 ? '#2196F3' : '#333',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                            title={`${newW} x ${newH}`}
                          >
                            {pct % 1 === 0 ? pct : pct.toFixed(1)}%
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                <div style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    Original: {component.originalSize.width} x {component.originalSize.height}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => {
                        updateComponentWithScrollPreservation(component.id, {
                          size: { ...component.originalSize! }
                        });
                      }}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      title="Reset to original size"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => {
                        updateComponentWithScrollPreservation(component.id, {
                          originalSize: { ...component.size }
                        });
                      }}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      title="Set current size as the new original"
                    >
                      Set as Original
                    </button>
                    <button
                      onClick={() => {
                        updateComponentWithScrollPreservation(component.id, {
                          originalSize: undefined
                        });
                      }}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      title="Remove original size reference"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  updateComponentWithScrollPreservation(component.id, {
                    originalSize: { ...component.size }
                  });
                }}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                title="Set current size as the original for percentage-based scaling"
              >
                Set Current as Original Size
              </button>
            )}
          </div>

          <div className="property-field" style={{ marginTop: '12px' }}>
            <label>Resize Anchor</label>
            <select
              value={component?.scaleAnchor || 'corner'}
              onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                scaleAnchor: e.target.value as any
              })}
            >
              <option value="corner">Opposite Corner (default)</option>
              <option value="center">Center</option>
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

          {getStateValue('autoContrastText', false) && (
            <div className="property-field">
              <label>Contrast Color Source</label>
              <select
                value={getStateValue('teamColorSide', '')}
                onChange={(e) => updateStateProps('teamColorSide', e.target.value || undefined)}
              >
                <option value="">Auto (infer from dataPath)</option>
                <option value="home">Home Team Color</option>
                <option value="away">Away Team Color</option>
              </select>
            </div>
          )}

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
                  onChange={(e) => {
                    const newDataPath = e.target.value;
                    // Check if this is an image data path
                    const isImagePath = newDataPath.endsWith('.imageUrl') ||
                                        newDataPath.endsWith('.image') ||
                                        newDataPath === 'imageUrl' ||
                                        newDataPath === 'image';
                    // If it's an image path and imageSource is 'local' (without a path), set to 'none'
                    // This allows the dataPath image to be used instead
                    const updatedProps: any = { ...component.props, dataPath: newDataPath };
                    if (isImagePath && component.props?.imageSource === 'local' && !component.props?.imagePath) {
                      updatedProps.imageSource = 'none';
                      updatedProps.objectFit = 'cover'; // Default to cover for player images
                    }
                    updateComponentWithScrollPreservation(component.id, { props: updatedProps });
                  }}
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
                  <optgroup label="Leaderboard (for Slot Templates)">
                    <option value="jersey">Player Jersey</option>
                    <option value="name">Player Name</option>
                    <option value="points">Player Points</option>
                    <option value="fouls">Player Fouls</option>
                    <option value="isTopScorer">Is Top Scorer (boolean)</option>
                    <option value="imageUrl">Player Image</option>
                  </optgroup>
                  <optgroup label="Active Player (Current Slot 0)">
                    <option value="currentPlayer.home.name">Home Active Player Name</option>
                    <option value="currentPlayer.home.jersey">Home Active Player Jersey</option>
                    <option value="currentPlayer.home.points">Home Active Player Points</option>
                    <option value="currentPlayer.home.imageUrl">Home Active Player Image</option>
                    <option value="currentPlayer.away.name">Away Active Player Name</option>
                    <option value="currentPlayer.away.jersey">Away Active Player Jersey</option>
                    <option value="currentPlayer.away.points">Away Active Player Points</option>
                    <option value="currentPlayer.away.imageUrl">Away Active Player Image</option>
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
                  <optgroup label="Leaderboard Slot Template">
                    <option value="isTopScorer">Is Top Scorer</option>
                    <option value="active">Slot Active</option>
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
                            const nativeSize = {
                              width: img.naturalWidth,
                              height: img.naturalHeight
                            };
                            updateComponentWithScrollPreservation(component.id, {
                              size: nativeSize,
                              // Also set originalSize for percentage-based scaling
                              originalSize: nativeSize,
                              // Don't lock aspect ratio by default - user can lock it manually if needed
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
                      Native Resolution
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Image Flip Buttons */}
              {(getStateValue('imageSource', 'none') === 'local' && getStateValue('imagePath', '')) ||
               (getStateValue('imageSource', 'none') === 'url' && getStateValue('imageUrl', '')) ? (
                <div className="property-field">
                  <label>Flip Image</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => updateStateProps('flipHorizontal', !getStateValue('flipHorizontal', false))}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: getStateValue('flipHorizontal', false) ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: getStateValue('flipHorizontal', false) ? 'bold' : 'normal',
                        fontSize: '12px'
                      }}
                    >
                      Horizontal
                    </button>
                    <button
                      onClick={() => updateStateProps('flipVertical', !getStateValue('flipVertical', false))}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: getStateValue('flipVertical', false) ? '#4CAF50' : '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: getStateValue('flipVertical', false) ? 'bold' : 'normal',
                        fontSize: '12px'
                      }}
                    >
                      Vertical
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
                  <option value="none">No Image / Data Path</option>
                  <option value="local">Local Image</option>
                  <option value="url">URL</option>
                </select>
                {/* Show hint when using image dataPath */}
                {(() => {
                  const dataPath = component.props?.dataPath || '';
                  const isImagePath = dataPath.endsWith('.imageUrl') || dataPath.endsWith('.image') || dataPath === 'imageUrl' || dataPath === 'image';
                  if (isImagePath && getStateValue('imageSource', 'none') === 'none') {
                    return (
                      <small style={{ color: '#4CAF50', display: 'block', marginTop: '4px' }}>
                        Using image from Data Path: {dataPath}
                      </small>
                    );
                  }
                  if (isImagePath && getStateValue('imageSource', 'none') !== 'none') {
                    return (
                      <small style={{ color: '#ff9800', display: 'block', marginTop: '4px' }}>
                        Tip: Set to "No Image / Data Path" to use image from Data Path
                      </small>
                    );
                  }
                  return null;
                })()}
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
                        updateStateProps('borderTopLeftRadius', Math.max(0, currentValue - 5));
                      }}
                      className="radius-quick-button minus"
                    >
                      -5
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
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 5;
                        updateStateProps('borderTopLeftRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +5
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↗ Top Right</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderTopRightRadius', 0);
                        updateStateProps('borderTopRightRadius', Math.max(0, currentValue - 5));
                      }}
                      className="radius-quick-button minus"
                    >
                      -5
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
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 5;
                        updateStateProps('borderTopRightRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +5
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↙ Bottom Left</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomLeftRadius', 0);
                        updateStateProps('borderBottomLeftRadius', Math.max(0, currentValue - 5));
                      }}
                      className="radius-quick-button minus"
                    >
                      -5
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
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 5;
                        updateStateProps('borderBottomLeftRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +5
                    </button>
                  </div>
                </div>
                <div className="corner-control">
                  <label>↘ Bottom Right</label>
                  <div className="radius-input-group">
                    <button
                      onClick={() => {
                        const currentValue = getStateValue('borderBottomRightRadius', 0);
                        updateStateProps('borderBottomRightRadius', Math.max(0, currentValue - 5));
                      }}
                      className="radius-quick-button minus"
                    >
                      -5
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
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 5;
                        updateStateProps('borderBottomRightRadius', nextValue);
                      }}
                      className="radius-quick-button"
                    >
                      +5
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

        {/* LEADERBOARD LIST SETTINGS */}
        {component.type === 'leaderboardList' && (
          <>
            {/* LEADERBOARD DISPLAY */}
            <PropertySection title="LEADERBOARD DISPLAY" sectionKey="leaderboard-display">
              <div className="property-field">
                <label>Team</label>
                <select
                  value={component.team || 'home'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    team: e.target.value as 'home' | 'away'
                  })}
                >
                  <option value="home">Home Team</option>
                  <option value="away">Away Team</option>
                </select>
              </div>

              <div className="property-field">
                <label>Max Visible Players</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  defaultValue={component.props?.maxVisible || 5}
                  onChange={(e) => handleNumberChange('maxVisible', e.target.value)}
                  onBlur={(e) => updateProp('maxVisible', parseInt(e.target.value) || 5)}
                />
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.showJersey !== false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, showJersey: e.target.checked }
                    })}
                  />
                  Show Jersey Number
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.showName !== false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, showName: e.target.checked }
                    })}
                  />
                  Show Player Name
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.showPoints !== false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, showPoints: e.target.checked }
                    })}
                  />
                  Show Points
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.showFouls || false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, showFouls: e.target.checked }
                    })}
                  />
                  Show Fouls
                </label>
              </div>
            </PropertySection>

            {/* LEADERBOARD STYLING */}
            <PropertySection title="LEADERBOARD STYLING" sectionKey="leaderboard-styling">
              <div className="property-field">
                <label>Slot Height (px)</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  defaultValue={component.props?.slotHeight || 60}
                  onChange={(e) => handleNumberChange('slotHeight', e.target.value)}
                  onBlur={(e) => updateProp('slotHeight', parseInt(e.target.value) || 60)}
                />
              </div>

              <div className="property-field">
                <label>Slot Spacing (px)</label>
                <input
                  type="number"
                  min="0"
                  max="32"
                  defaultValue={component.props?.slotSpacing || 5}
                  onChange={(e) => handleNumberChange('slotSpacing', e.target.value)}
                  onBlur={(e) => updateProp('slotSpacing', parseInt(e.target.value) || 8)}
                />
              </div>

              <div className="property-field">
                <label>Font Size</label>
                <input
                  type="number"
                  min="10"
                  max="72"
                  defaultValue={component.props?.fontSize || 24}
                  onChange={(e) => handleNumberChange('fontSize', e.target.value)}
                  onBlur={(e) => updateProp('fontSize', parseInt(e.target.value) || 24)}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Text Color"
                  value={component.props?.textColor || '#ffffff'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, textColor: color }
                  })}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Background Color"
                  value={component.props?.backgroundColor || 'transparent'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, backgroundColor: color }
                  })}
                />
              </div>

              <div className="property-field">
                <ColorPicker
                  label="Highlight Color (Top Scorer)"
                  value={component.props?.highlightColor || '#FFD700'}
                  onChange={(color) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, highlightColor: color }
                  })}
                />
              </div>
            </PropertySection>

            {/* LEADERBOARD CYCLING */}
            <PropertySection title="LEADERBOARD CYCLING" sectionKey="leaderboard-cycling">
              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={component.props?.cycleEnabled || false}
                    onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, cycleEnabled: e.target.checked }
                    })}
                  />
                  Enable Cycling
                </label>
                <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                  Automatically cycles through players when there are more than max visible
                </small>
              </div>

              {component.props?.cycleEnabled && (
                <div className="property-field">
                  <label>Cycle Interval (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="30000"
                    step="500"
                    defaultValue={component.props?.cycleInterval || 5000}
                    onChange={(e) => handleNumberChange('cycleInterval', e.target.value)}
                    onBlur={(e) => updateProp('cycleInterval', parseInt(e.target.value) || 5000)}
                  />
                </div>
              )}
            </PropertySection>
          </>
        )}

        {/* SLOT LIST SETTINGS */}
        {component.type === 'slotList' && (
          <>
            <PropertySection title="SLOT LIST CONFIGURATION" sectionKey="slotlist-config">
              <div className="property-field">
                <label>Template</label>
                <select
                  value={component.props?.templateId || ''}
                  onChange={(e) => {
                    const newTemplateId = e.target.value;
                    updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, templateId: newTemplateId }
                    });
                    // Auto-update size when template changes
                    updateSlotListSize(
                      component.id,
                      newTemplateId,
                      component.props?.slotCount || 5,
                      component.props?.slotSpacing || 5,
                      component.props?.direction || 'vertical'
                    );
                  }}
                >
                  <option value="">-- Select Template --</option>
                  {slotTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                  Create templates by selecting components and clicking "Save Selection as Slot Template"
                </small>
              </div>

              <div className="property-field">
                <label>Team</label>
                <select
                  value={component.props?.team || 'home'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, team: e.target.value }
                  })}
                >
                  <option value="home">Home Team</option>
                  <option value="away">Away Team</option>
                </select>
              </div>

              <div className="property-field">
                <label>Data Path Prefix</label>
                <select
                  value={component.props?.dataPathPrefix || 'leaderboardSlots'}
                  onChange={(e) => updateComponentWithScrollPreservation(component.id, {
                    props: { ...component.props, dataPathPrefix: e.target.value }
                  })}
                >
                  <option value="leaderboardSlots">Leaderboard Slots</option>
                  <option value="penaltySlots">Penalty Slots</option>
                </select>
                <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                  Template data paths will be prefixed with this + team + slot number
                </small>
              </div>

              <div className="property-field">
                <label>Number of Slots</label>
                <DebouncedInput
                  type="number"
                  min="1"
                  max="10"
                  value={component.props?.slotCount || 5}
                  onCommit={(val) => {
                    const newSlotCount = parseInt(val) || 5;
                    updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, slotCount: newSlotCount }
                    });
                    updateSlotListSize(
                      component.id,
                      component.props?.templateId,
                      newSlotCount,
                      component.props?.slotSpacing || 5,
                      component.props?.direction || 'vertical'
                    );
                  }}
                />
              </div>

              <div className="property-field">
                <label>Slot Spacing (px)</label>
                <DebouncedInput
                  type="number"
                  min="0"
                  max="50"
                  value={component.props?.slotSpacing || 5}
                  onCommit={(val) => {
                    const newSpacing = parseInt(val) || 5;
                    updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, slotSpacing: newSpacing }
                    });
                    updateSlotListSize(
                      component.id,
                      component.props?.templateId,
                      component.props?.slotCount || 5,
                      newSpacing,
                      component.props?.direction || 'vertical'
                    );
                  }}
                />
              </div>

              <div className="property-field">
                <label>Direction</label>
                <select
                  value={component.props?.direction || 'vertical'}
                  onChange={(e) => {
                    const newDirection = e.target.value as 'vertical' | 'horizontal';
                    updateComponentWithScrollPreservation(component.id, {
                      props: { ...component.props, direction: newDirection }
                    });
                    updateSlotListSize(
                      component.id,
                      component.props?.templateId,
                      component.props?.slotCount || 5,
                      component.props?.slotSpacing || 5,
                      newDirection
                    );
                  }}
                >
                  <option value="vertical">Vertical (stack down)</option>
                  <option value="horizontal">Horizontal (stack right)</option>
                </select>
              </div>

              <div className="property-field">
                <label>Slot Size</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <small style={{ color: '#888' }}>Width</small>
                    <DebouncedInput
                      type="number"
                      value={(() => {
                        const templateId = component.props?.templateId;
                        const template = templateId ? slotTemplates.find(t => t.id === templateId) : null;
                        return template?.slotSize.width || '';
                      })()}
                      onCommit={(val) => {
                        const newWidth = parseInt(val, 10);
                        if (isNaN(newWidth) || newWidth < 1) return;
                        const templateId = component.props?.templateId;
                        if (!templateId) return;
                        const template = slotTemplates.find(t => t.id === templateId);
                        if (!template) return;
                        const scale = newWidth / template.slotSize.width;
                        const updatedTemplates = slotTemplates.map(t => {
                          if (t.id !== templateId) return t;
                          return {
                            ...t,
                            slotSize: { ...t.slotSize, width: newWidth },
                            components: t.components.map(c => ({
                              ...c,
                              position: { ...c.position, x: Math.round(c.position.x * scale) },
                              size: { ...c.size, width: Math.round(c.size.width * scale) },
                            })),
                            updatedAt: Date.now(),
                          };
                        });
                        saveTemplates(updatedTemplates);
                        setSlotTemplates(updatedTemplates);
                      }}
                      style={{ width: '100%', padding: '4px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <small style={{ color: '#888' }}>Height</small>
                    <DebouncedInput
                      type="number"
                      value={(() => {
                        const templateId = component.props?.templateId;
                        const template = templateId ? slotTemplates.find(t => t.id === templateId) : null;
                        return template?.slotSize.height || '';
                      })()}
                      onCommit={(val) => {
                        const newHeight = parseInt(val, 10);
                        if (isNaN(newHeight) || newHeight < 1) return;
                        const templateId = component.props?.templateId;
                        if (!templateId) return;
                        const template = slotTemplates.find(t => t.id === templateId);
                        if (!template) return;
                        const scale = newHeight / template.slotSize.height;
                        const updatedTemplates = slotTemplates.map(t => {
                          if (t.id !== templateId) return t;
                          return {
                            ...t,
                            slotSize: { ...t.slotSize, height: newHeight },
                            components: t.components.map(c => ({
                              ...c,
                              position: { ...c.position, y: Math.round(c.position.y * scale) },
                              size: { ...c.size, height: Math.round(c.size.height * scale) },
                            })),
                            updatedAt: Date.now(),
                          };
                        });
                        saveTemplates(updatedTemplates);
                        setSlotTemplates(updatedTemplates);
                      }}
                      style={{ width: '100%', padding: '4px' }}
                    />
                  </div>
                </div>
                <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                  Directly set slot dimensions (scales template components proportionally)
                </small>
              </div>

              {/* Scale by Percentage */}
              {(() => {
                const templateId = component.props?.templateId;
                const template = templateId ? slotTemplates.find(t => t.id === templateId) : null;
                if (!template) return null;

                // Initialize originalSlotSize if not set
                const originalWidth = template.originalSlotSize?.width || template.slotSize.width;
                const originalHeight = template.originalSlotSize?.height || template.slotSize.height;
                const currentScale = (template.slotSize.width / originalWidth) * 100;

                // Calculate grid-aligned scale percentages (5px increments)
                const getValidScales = () => {
                  const scales: number[] = [];
                  // Check percentages from 20% to 200%
                  for (let pct = 20; pct <= 200; pct += 5) {
                    const scaledW = Math.round(originalWidth * pct / 100);
                    const scaledH = Math.round(originalHeight * pct / 100);
                    // Only include if both dimensions are divisible by 5
                    if (scaledW % 5 === 0 && scaledH % 5 === 0 && scaledW >= 10 && scaledH >= 10) {
                      scales.push(pct);
                    }
                  }
                  return scales;
                };

                const validScales = getValidScales();

                const applyScale = (scalePercent: number) => {
                  const newWidth = Math.round(originalWidth * scalePercent / 100);
                  const newHeight = Math.round(originalHeight * scalePercent / 100);
                  const scaleX = newWidth / template.slotSize.width;
                  const scaleY = newHeight / template.slotSize.height;

                  const updatedTemplates = slotTemplates.map(t => {
                    if (t.id !== templateId) return t;
                    return {
                      ...t,
                      slotSize: { width: newWidth, height: newHeight },
                      originalSlotSize: t.originalSlotSize || { width: originalWidth, height: originalHeight },
                      components: t.components.map(c => ({
                        ...c,
                        position: {
                          x: Math.round(c.position.x * scaleX),
                          y: Math.round(c.position.y * scaleY)
                        },
                        size: {
                          width: Math.round(c.size.width * scaleX),
                          height: Math.round(c.size.height * scaleY)
                        },
                      })),
                      updatedAt: Date.now(),
                    };
                  });
                  saveTemplates(updatedTemplates);
                  setSlotTemplates(updatedTemplates);
                };

                return (
                  <div className="property-field" style={{ marginTop: '12px' }}>
                    <label>Scale %</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <DebouncedInput
                        type="number"
                        value={currentScale.toFixed(1)}
                        onCommit={(val) => {
                          const pct = parseFloat(val);
                          if (isNaN(pct) || pct < 10 || pct > 500) return;
                          applyScale(pct);
                        }}
                        style={{ width: '70px', padding: '4px' }}
                        step={0.1}
                      />
                      <span style={{ color: '#888', fontSize: '12px' }}>%</span>
                      <span style={{ color: '#666', fontSize: '11px', marginLeft: '8px' }}>
                        Original: {originalWidth}x{originalHeight}
                      </span>
                    </div>
                    {/* Quick scale buttons */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {[25, 50, 75, 100, 125, 150].map(pct => (
                        <button
                          key={pct}
                          onClick={() => applyScale(pct)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            backgroundColor: Math.abs(currentScale - pct) < 0.5 ? '#4CAF50' : '#3a3a3a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    {/* Grid-aligned scale options (5px increments) */}
                    {validScales.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <small style={{ color: '#888', display: 'block', marginBottom: '4px' }}>
                          Grid-aligned (5px increments):
                        </small>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxHeight: '60px', overflowY: 'auto' }}>
                          {validScales.filter(pct => pct >= 50 && pct <= 150).map(pct => {
                            const w = Math.round(originalWidth * pct / 100);
                            const h = Math.round(originalHeight * pct / 100);
                            return (
                              <button
                                key={pct}
                                onClick={() => applyScale(pct)}
                                title={`${w}x${h}`}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  backgroundColor: Math.abs(currentScale - pct) < 0.5 ? '#2196F3' : '#2a2a2a',
                                  color: 'white',
                                  border: '1px solid #444',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                {pct}%
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Reset to original */}
                    {template.originalSlotSize && Math.abs(currentScale - 100) > 0.5 && (
                      <button
                        onClick={() => applyScale(100)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 12px',
                          fontSize: '11px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        Reset to Original Size ({originalWidth}x{originalHeight})
                      </button>
                    )}
                  </div>
                );
              })()}
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
                  <optgroup label="Leaderboard Slot Template">
                    <option value="isTopScorer">Is Top Scorer</option>
                    <option value="active">Slot Active</option>
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