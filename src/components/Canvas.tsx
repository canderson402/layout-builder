import React, { useRef, useState, useCallback } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import WebPreview from './WebPreview';
import './Canvas.css';

interface CanvasProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onDeleteComponent: (id: string) => void;
  onDuplicateComponent: (id: string) => void;
  draggedComponent: ComponentConfig | null;
  setDraggedComponent: (component: ComponentConfig | null) => void;
  onAddComponent: (type: ComponentConfig['type'], customPosition?: { x: number, y: number }, customSize?: { width: number, height: number }) => void;
  onStartDragOperation: () => void;
  onEndDragOperation: (description: string) => void;
  onUpdateLayout: (updates: Partial<LayoutConfig>) => void;
  gameData?: any;
}

// Pixel-based grid settings
const DEFAULT_GRID_SIZE = 20;
const DEFAULT_SNAP_THRESHOLD = 25; // Default snap threshold in pixels
const SNAP_THRESHOLD_OPTIONS = [5, 10, 15, 20, 25, 35, 50]; // Snap strength options (higher = stickier)
const GRID_SIZE_OPTIONS = [5, 10, 20]; // Grid spacing options in pixels

// Smart guide types
interface SmartGuide {
  type: 'center-h' | 'center-v' | 'edge-top' | 'edge-bottom' | 'edge-left' | 'edge-right' | 'element-center-h' | 'element-center-v';
  position: number; // x for vertical lines, y for horizontal lines
  label?: string; // Optional distance label
}

interface ActiveGuides {
  guides: SmartGuide[];
  elementBounds?: { // The bounds of the element being moved (for rendering guides)
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
  };
}

// Common resolution presets
const RESOLUTION_PRESETS = [
  { name: 'HD 720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
  { name: 'Custom', width: 0, height: 0 } // Special case for custom input
];

export default function Canvas({
  layout,
  selectedComponents,
  onSelectComponents,
  onUpdateComponent,
  onDeleteComponent,
  onDuplicateComponent,
  draggedComponent,
  setDraggedComponent,
  onAddComponent,
  onStartDragOperation,
  onEndDragOperation,
  onUpdateLayout,
  gameData
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  const selectedComponentsRef = useRef(selectedComponents);
  
  // Keep refs updated
  layoutRef.current = layout;
  selectedComponentsRef.current = selectedComponents;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [showGrid, setShowGrid] = useState(true);
  const [showHalfwayLines, setShowHalfwayLines] = useState(false);
  const [gridSizeIndex, setGridSizeIndex] = useState(2); // Default to 20px grid (index 2)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(50); // Zoom level from 10% to 200%
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState({ x: 0, y: 0 });
  const [createEnd, setCreateEnd] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasDraggedFarEnough, setHasDraggedFarEnough] = useState(false);
  const [initialComponentPositions, setInitialComponentPositions] = useState<Map<string, { x: number, y: number }>>(new Map());
  
  // Viewport panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });

  // Smart guides state
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({ guides: [] });

  // Configurable snap threshold (snap strength)
  const [snapThresholdIndex, setSnapThresholdIndex] = useState(4); // Default to 25px (index 4)
  const snapThreshold = SNAP_THRESHOLD_OPTIONS[snapThresholdIndex] || DEFAULT_SNAP_THRESHOLD;
  
  
  // Throttle drag updates for better performance
  const lastUpdateTime = useRef(0);
  const THROTTLE_MS = 16; // ~60fps

  // Ref to store handleResize function to avoid initialization order issues
  const handleResizeRef = useRef<((canvasX: number, canvasY: number, maintainAspectRatio?: boolean) => void) | null>(null);

  // Helper function to handle component selection with Ctrl/Cmd for multi-select
  const handleComponentSelect = useCallback((componentId: string, isCtrlClick: boolean = false) => {
    if (isCtrlClick) {
      // Toggle selection of this component
      if (selectedComponents.includes(componentId)) {
        onSelectComponents(selectedComponents.filter(id => id !== componentId));
      } else {
        onSelectComponents([...selectedComponents, componentId]);
      }
    } else {
      // Single selection
      onSelectComponents([componentId]);
    }
  }, [selectedComponents, onSelectComponents]);

  // Simple pixel-based grid
  const gridSize = GRID_SIZE_OPTIONS[gridSizeIndex] || DEFAULT_GRID_SIZE;

  const decreaseGridSize = () => {
    const prevIndex = gridSizeIndex > 0 ? gridSizeIndex - 1 : GRID_SIZE_OPTIONS.length - 1;
    setGridSizeIndex(prevIndex);
  };

  const increaseGridSize = () => {
    const nextIndex = (gridSizeIndex + 1) % GRID_SIZE_OPTIONS.length;
    setGridSizeIndex(nextIndex);
  };

  // Center-aware pixel-based grid snapping
  const snapToGrid = useCallback((value: number, dimension: 'width' | 'height') => {
    const layoutDimension = dimension === 'width' ? layout.dimensions.width : layout.dimensions.height;
    const center = layoutDimension / 2;

    // Always allow snapping to the exact center
    if (Math.abs(value - center) <= snapThreshold) {
      return center;
    }

    // For larger grid sizes, add center as an additional snap point
    if (gridSize >= 50) {
      const regularSnap = Math.round(value / gridSize) * gridSize;
      const distToRegular = Math.abs(value - regularSnap);
      const distToCenter = Math.abs(value - center);

      // If we're closer to center than regular grid, snap to center
      if (distToCenter < distToRegular && distToCenter <= snapThreshold) {
        return center;
      }

      return regularSnap;
    }

    // For smaller grid sizes, use regular snapping
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize, layout.dimensions.width, layout.dimensions.height, snapThreshold]);

  const shouldSnap = useCallback((value: number, snappedValue: number) => {
    return Math.abs(value - snappedValue) <= SNAP_THRESHOLD;
  }, []);

  // Smart snapping function that returns snapped position and active guides
  const smartSnap = useCallback((
    rawX: number,
    rawY: number,
    componentWidth: number,
    componentHeight: number,
    enableSnapping: boolean
  ): { x: number; y: number; guides: ActiveGuides } => {
    const guides: SmartGuide[] = [];
    let snappedX = rawX;
    let snappedY = rawY;

    const canvasWidth = layout.dimensions.width;
    const canvasHeight = layout.dimensions.height;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    // Calculate element bounds and center
    const elementLeft = rawX;
    const elementRight = rawX + componentWidth;
    const elementTop = rawY;
    const elementBottom = rawY + componentHeight;
    const elementCenterX = rawX + componentWidth / 2;
    const elementCenterY = rawY + componentHeight / 2;

    if (enableSnapping) {
      // Track if we've snapped on each axis to prevent conflicting snaps
      let snappedOnX = false;
      let snappedOnY = false;

      // 1. Check element CENTER to canvas center (highest priority)
      if (Math.abs(elementCenterX - canvasCenterX) <= snapThreshold) {
        snappedX = canvasCenterX - componentWidth / 2;
        guides.push({ type: 'center-v', position: canvasCenterX });
        snappedOnX = true;
      }

      if (Math.abs(elementCenterY - canvasCenterY) <= snapThreshold) {
        snappedY = canvasCenterY - componentHeight / 2;
        guides.push({ type: 'center-h', position: canvasCenterY });
        snappedOnY = true;
      }

      // 2. Check element LEFT edge to canvas center (vertical line)
      if (!snappedOnX && Math.abs(elementLeft - canvasCenterX) <= snapThreshold) {
        snappedX = canvasCenterX;
        guides.push({ type: 'center-v', position: canvasCenterX });
        snappedOnX = true;
      }

      // 3. Check element RIGHT edge to canvas center (vertical line)
      if (!snappedOnX && Math.abs(elementRight - canvasCenterX) <= snapThreshold) {
        snappedX = canvasCenterX - componentWidth;
        guides.push({ type: 'center-v', position: canvasCenterX });
        snappedOnX = true;
      }

      // 4. Check element TOP edge to canvas center (horizontal line)
      if (!snappedOnY && Math.abs(elementTop - canvasCenterY) <= snapThreshold) {
        snappedY = canvasCenterY;
        guides.push({ type: 'center-h', position: canvasCenterY });
        snappedOnY = true;
      }

      // 5. Check element BOTTOM edge to canvas center (horizontal line)
      if (!snappedOnY && Math.abs(elementBottom - canvasCenterY) <= snapThreshold) {
        snappedY = canvasCenterY - componentHeight;
        guides.push({ type: 'center-h', position: canvasCenterY });
        snappedOnY = true;
      }

      // 6. Check left edge to canvas left
      if (!snappedOnX && Math.abs(elementLeft) <= snapThreshold) {
        snappedX = 0;
        guides.push({ type: 'edge-left', position: 0 });
        snappedOnX = true;
      }

      // 7. Check right edge to canvas right
      if (!snappedOnX && Math.abs(elementRight - canvasWidth) <= snapThreshold) {
        snappedX = canvasWidth - componentWidth;
        guides.push({ type: 'edge-right', position: canvasWidth });
        snappedOnX = true;
      }

      // 8. Check top edge to canvas top
      if (!snappedOnY && Math.abs(elementTop) <= snapThreshold) {
        snappedY = 0;
        guides.push({ type: 'edge-top', position: 0 });
        snappedOnY = true;
      }

      // 9. Check bottom edge to canvas bottom
      if (!snappedOnY && Math.abs(elementBottom - canvasHeight) <= snapThreshold) {
        snappedY = canvasHeight - componentHeight;
        guides.push({ type: 'edge-bottom', position: canvasHeight });
        snappedOnY = true;
      }

      // If no smart guides triggered, fall back to grid snapping
      if (guides.length === 0 && showGrid) {
        snappedX = snapToGrid(snappedX, 'width');
        snappedY = snapToGrid(snappedY, 'height');
      }
    }

    // Calculate final element bounds after snapping
    const finalCenterX = snappedX + componentWidth / 2;
    const finalCenterY = snappedY + componentHeight / 2;

    return {
      x: snappedX,
      y: snappedY,
      guides: {
        guides,
        elementBounds: {
          left: snappedX,
          top: snappedY,
          right: snappedX + componentWidth,
          bottom: snappedY + componentHeight,
          centerX: finalCenterX,
          centerY: finalCenterY
        }
      }
    };
  }, [layout.dimensions.width, layout.dimensions.height, snapToGrid, showGrid, snapThreshold]);

  // Use manual zoom level (10% to 200%)
  const scale = zoomLevel / 100;

  // Track the last selected component ID for cycling
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [componentsAtClickPosition, setComponentsAtClickPosition] = useState<ComponentConfig[]>([]);
  
  // Resolution management state
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const currentPreset = RESOLUTION_PRESETS.find(p => 
      p.width === layout.dimensions.width && p.height === layout.dimensions.height
    );
    return currentPreset?.name || 'Custom';
  });
  const [customWidth, setCustomWidth] = useState(layout.dimensions.width.toString());
  const [customHeight, setCustomHeight] = useState(layout.dimensions.height.toString());
  
  // Handle resolution changes
  const handleResolutionChange = useCallback((presetName: string) => {
    setSelectedPreset(presetName);
    
    if (presetName !== 'Custom') {
      const preset = RESOLUTION_PRESETS.find(p => p.name === presetName);
      if (preset) {
        onUpdateLayout({
          dimensions: {
            width: preset.width,
            height: preset.height
          }
        });
        setCustomWidth(preset.width.toString());
        setCustomHeight(preset.height.toString());
      }
    }
  }, [onUpdateLayout]);
  
  // Handle custom resolution input
  const handleCustomResolution = useCallback(() => {
    const width = parseInt(customWidth);
    const height = parseInt(customHeight);
    
    if (width > 0 && height > 0 && !isNaN(width) && !isNaN(height)) {
      onUpdateLayout({
        dimensions: {
          width,
          height
        }
      });
      
      // Check if this matches a preset
      const matchingPreset = RESOLUTION_PRESETS.find(p => 
        p.width === width && p.height === height
      );
      setSelectedPreset(matchingPreset?.name || 'Custom');
    }
  }, [customWidth, customHeight, onUpdateLayout]);

  const handleMouseDown = useCallback((e: React.MouseEvent, component: ComponentConfig) => {
    // Allow middle mouse button to bubble up to canvas for panning
    if (e.button === 1) {
      return; // Don't prevent default or stop propagation - let canvas handle it
    }
    
    // Prevent synthetic touch events from interfering
    if (e.type === 'touchstart') {
      e.preventDefault();
    }
    e.stopPropagation();
    
    const isCtrlClick = e.ctrlKey || e.metaKey;
    const isAlreadySelected = selectedComponents.includes(component.id);
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / scale;
    const canvasY = (e.clientY - rect.top) / scale;
    
    // Store initial mouse position for drag detection
    setDragStartPos({ x: canvasX, y: canvasY });
    setHasDraggedFarEnough(false);
    
    // Find all components at this click position
    const componentsAtPosition = (layout.components || [])
      .filter(c => c.visible !== false)
      .filter(c => {
        const left = c.position.x;
        const right = c.position.x + c.size.width;
        const top = c.position.y;
        const bottom = c.position.y + c.size.height;
        return canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom;
      })
      .sort((a, b) => (b.layer || 0) - (a.layer || 0)); // Sort by layer, highest first
    
    // Store the components at this position for potential cycling on mouseUp
    setComponentsAtClickPosition(componentsAtPosition);
    
    // For now, just set up for potential drag with the topmost or currently selected component
    const currentComponent = componentsAtPosition.find(c => selectedComponents.includes(c.id)) || componentsAtPosition[0] || component;
    
    // Set up for potential drag
    setDraggedComponent(currentComponent);
    setDragOffset({
      x: canvasX - currentComponent.position.x,
      y: canvasY - currentComponent.position.y
    });
    
    // Handle ctrl+click immediately
    if (isCtrlClick) {
      // Ctrl+click: toggle this component in the selection
      handleComponentSelect(currentComponent.id, true);
      setLastSelectedId(currentComponent.id);
    }
  }, [handleComponentSelect, setDraggedComponent, layout, scale, selectedComponents, lastSelectedId, isDragging, isResizing]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / scale;
    const canvasY = (e.clientY - rect.top) / scale;
    
    // Handle viewport panning
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      setViewportOffset({
        x: viewportOffset.x + deltaX,
        y: viewportOffset.y + deltaY
      });
      
      setPanStart({ x: e.clientX, y: e.clientY });
      return; // Don't process other mouse movements while panning
    }
    
    
    // Check if we've moved far enough to start an operation
    if (draggedComponent && !isDragging && !isCreating && !isResizing) {
      const deltaX = Math.abs(canvasX - dragStartPos.x);
      const deltaY = Math.abs(canvasY - dragStartPos.y);
      const hasMoved = deltaX > 3 || deltaY > 3; // 3px threshold
      
      if (hasMoved) {
        const isAlreadySelected = selectedComponents.includes(draggedComponent.id);
        
        if (isAlreadySelected) {
          // Start dragging selected component
          onStartDragOperation(); // Save initial state for undo
          setIsDragging(true);
          setHasDraggedFarEnough(true);

          // Store initial positions of all selected components
          const positions = new Map<string, { x: number, y: number }>();
          selectedComponentsRef.current.forEach(componentId => {
            const component = layoutRef.current.components.find(c => c.id === componentId);
            if (component) {
              positions.set(componentId, { x: component.position.x, y: component.position.y });
            }
          });
          setInitialComponentPositions(positions);

          // Notify PropertyPanel to pause expensive rendering
          window.dispatchEvent(new CustomEvent('canvas-drag-start'));
        } else {
          // Select the unselected component and start dragging it
          handleComponentSelect(draggedComponent.id, false);
          onStartDragOperation(); // Save initial state for undo
          setIsDragging(true);
          setHasDraggedFarEnough(true);

          // Store initial position of the single selected component
          const positions = new Map<string, { x: number, y: number }>();
          positions.set(draggedComponent.id, { x: draggedComponent.position.x, y: draggedComponent.position.y });
          setInitialComponentPositions(positions);

          // Notify PropertyPanel to pause expensive rendering
          window.dispatchEvent(new CustomEvent('canvas-drag-start'));
        }
      }
    }
    
    if (!isDragging && !isResizing && !isCreating) return;

    // Handle creation dragging
    if (isCreating) {
      setCreateEnd({ x: canvasX, y: canvasY });
      return;
    }
    
    if (!draggedComponent) return;

    if (isDragging) {
      // Throttle drag updates for better performance
      const now = Date.now();
      if (now - lastUpdateTime.current < THROTTLE_MS) {
        return;
      }
      lastUpdateTime.current = now;

      // Calculate raw mouse movement delta (before any snapping)
      const rawX = canvasX - dragOffset.x;
      const rawY = canvasY - dragOffset.y;

      // Get the initial position of the primary component
      const initialPrimaryPos = initialComponentPositions.get(draggedComponent.id) || draggedComponent.position;

      // Component size is already in pixels
      let compWidth = draggedComponent.size.width;
      let compHeight = draggedComponent.size.height;

      // Only snap component size to grid if grid is enabled
      if (showGrid) {
        compWidth = snapToGrid(compWidth, 'width');
        compHeight = snapToGrid(compHeight, 'height');
      }

      // Use smart snapping for position (includes center and edge snapping with visual guides)
      const snapResult = smartSnap(rawX, rawY, compWidth, compHeight, true);
      const newX = snapResult.x;
      const newY = snapResult.y;

      // Update active guides for visual feedback
      setActiveGuides(snapResult.guides);

      // Update the primary dragged component with pixel values
      onUpdateComponent(draggedComponent.id, {
        position: { x: newX, y: newY },
        size: { width: compWidth, height: compHeight }
      });

      // If multiple components are selected, move them all by the same delta from their initial positions
      if (selectedComponentsRef.current.length > 1) {
        // Calculate the delta from the snapped position
        const snappedDeltaX = newX - initialPrimaryPos.x;
        const snappedDeltaY = newY - initialPrimaryPos.y;

        selectedComponentsRef.current.forEach(componentId => {
          if (componentId !== draggedComponent.id) {
            const initialPos = initialComponentPositions.get(componentId);
            if (initialPos) {
              // Apply the same snapped delta from the component's initial position
              const movedX = initialPos.x + snappedDeltaX;
              const movedY = initialPos.y + snappedDeltaY;

              onUpdateComponent(componentId, {
                position: { x: movedX, y: movedY }
              });
            }
          }
        });
      }
    }

    if (isResizing) {
      // Handle resizing logic here - will call handleResize defined below
      // Using a function ref to avoid dependency issues
      if (handleResizeRef.current) {
        handleResizeRef.current(canvasX, canvasY, e.metaKey || e.ctrlKey);
      }
    }
  }, [isDragging, isResizing, draggedComponent, dragOffset, onUpdateComponent, snapToGrid, smartSnap, scale, showGrid, isPanning, isCreating, panStart, viewportOffset]);

  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    // Handle viewport panning end
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    
    // Handle case where we clicked but didn't drag (should either select or cycle)
    if (draggedComponent && !isDragging && !isCreating && !hasDraggedFarEnough) {
      // Check if we should cycle through overlapping components
      if (componentsAtClickPosition.length > 1) {
        // Multiple components at click position - cycle through them
        const currentIndex = componentsAtClickPosition.findIndex(c => c.id === lastSelectedId);
        
        let nextComponent: ComponentConfig;
        if (currentIndex === -1 || currentIndex === componentsAtClickPosition.length - 1) {
          // If no component was selected or we're at the end, start from the beginning
          nextComponent = componentsAtClickPosition[0];
        } else {
          // Select the next component in the stack
          nextComponent = componentsAtClickPosition[currentIndex + 1];
        }
        
        // Select the next component
        handleComponentSelect(nextComponent.id, false);
        setLastSelectedId(nextComponent.id);
      } else {
        // Single component - just select it if not already selected
        const isAlreadySelected = selectedComponents.includes(draggedComponent.id);
        if (!isAlreadySelected) {
          handleComponentSelect(draggedComponent.id, false);
          setLastSelectedId(draggedComponent.id);
        }
      }
    }
    
    // Handle component creation completion
    if (isCreating) {
      const width = Math.abs(createEnd.x - createStart.x);
      const height = Math.abs(createEnd.y - createStart.y);
      
      // Only create if dragged area is reasonably sized (at least 20x20 pixels)
      if (width >= 20 && height >= 20) {
        const left = Math.min(createStart.x, createEnd.x);
        const top = Math.min(createStart.y, createEnd.y);
        
        // Only snap to grid if grid is enabled
        const snappedLeft = showGrid ? snapToGrid(left, 'width') : left;
        const snappedTop = showGrid ? snapToGrid(top, 'height') : top;
        const snappedWidth = showGrid ? snapToGrid(width, 'width') : width;
        const snappedHeight = showGrid ? snapToGrid(height, 'height') : height;
        
        // Create component with the dragged dimensions in pixels
        const position = {
          x: snappedLeft,
          y: snappedTop
        };
        const size = {
          width: snappedWidth,
          height: snappedHeight
        };
        
        onAddComponent('custom', position, size);
      }
      
      setIsCreating(false);
      setCreateStart({ x: 0, y: 0 });
      setCreateEnd({ x: 0, y: 0 });
      return;
    }
    
    // End drag operation for undo if we were dragging or resizing
    if (isDragging && draggedComponent) {
      const component = (layout.components || []).find(c => c.id === draggedComponent.id);
      if (component) {
        onEndDragOperation(`Move ${component.type} component`);
      }
      // Notify PropertyPanel to resume normal rendering
      window.dispatchEvent(new CustomEvent('canvas-drag-end'));
    } else if (isResizing && draggedComponent) {
      const component = (layout.components || []).find(c => c.id === draggedComponent.id);
      if (component) {
        onEndDragOperation(`Resize ${component.type} component`);
      }
      // Notify PropertyPanel to resume normal rendering
      window.dispatchEvent(new CustomEvent('canvas-drag-end'));
    }
    
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle('');
    setDraggedComponent(null);
    setHasDraggedFarEnough(false);
    setComponentsAtClickPosition([]); // Clear the stored components
    setInitialComponentPositions(new Map()); // Clear initial positions
    setActiveGuides({ guides: [] }); // Clear smart guides
  }, [setDraggedComponent, isCreating, createStart, createEnd, snapToGrid, layout.dimensions, onAddComponent, showGrid, draggedComponent, isDragging, hasDraggedFarEnough, selectedComponents, handleComponentSelect, isResizing, onEndDragOperation, layout.components, isPanning, scale, onSelectComponents, layoutRef, componentsAtClickPosition, lastSelectedId, setLastSelectedId]);

  // Calculate bounding box for multiple selected components
  const getMultiSelectBounds = useCallback(() => {
    if (selectedComponents.length <= 1) return null;

    const selectedComponentData = selectedComponents
      .map(id => layout.components.find(c => c.id === id))
      .filter((c): c is ComponentConfig => c !== undefined);

    if (selectedComponentData.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    selectedComponentData.forEach(comp => {
      const left = comp.position.x;
      const top = comp.position.y;
      const right = comp.position.x + comp.size.width;
      const bottom = comp.position.y + comp.size.height;

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      components: selectedComponentData
    };
  }, [selectedComponents, layout.components]);

  // Handle multi-component resize
  const handleMultiResizeMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const bounds = getMultiSelectBounds();
    if (!bounds) return;

    onStartDragOperation(); // Save initial state for undo
    setIsResizing(true);
    setResizeHandle(handle);
    // Set a dummy component for the resize logic
    setDraggedComponent({
      id: 'multi-select',
      type: 'custom',
      position: { x: bounds.x, y: bounds.y },
      size: { width: bounds.width, height: bounds.height },
      props: {}
    } as ComponentConfig);
  }, [getMultiSelectBounds, onStartDragOperation, setDraggedComponent]);

  // Handle resize logic
  const handleResize = useCallback((canvasX: number, canvasY: number, maintainAspectRatio: boolean = false) => {
    if (!draggedComponent) return;

    // Check if this is a multi-component resize
    if (draggedComponent.id === 'multi-select' && selectedComponents.length > 1) {
      const bounds = getMultiSelectBounds();
      if (!bounds) return;

      // Calculate scale factors
      const originalWidth = bounds.width;
      const originalHeight = bounds.height;
      const originalLeft = bounds.x;
      const originalTop = bounds.y;

      let newWidth = originalWidth;
      let newHeight = originalHeight;
      let newX = originalLeft;
      let newY = originalTop;

      const minSize = 20;

      switch (resizeHandle) {
        case 'se': // Bottom-right
          newWidth = Math.max(minSize, canvasX - originalLeft);
          newHeight = Math.max(minSize, canvasY - originalTop);
          break;
        case 'sw': // Bottom-left
          newWidth = Math.max(minSize, originalLeft + originalWidth - canvasX);
          newHeight = Math.max(minSize, canvasY - originalTop);
          newX = canvasX;
          break;
        case 'ne': // Top-right
          newWidth = Math.max(minSize, canvasX - originalLeft);
          newHeight = Math.max(minSize, originalTop + originalHeight - canvasY);
          newY = canvasY;
          break;
        case 'nw': // Top-left
          newWidth = Math.max(minSize, originalLeft + originalWidth - canvasX);
          newHeight = Math.max(minSize, originalTop + originalHeight - canvasY);
          newX = canvasX;
          newY = canvasY;
          break;
      }

      // Calculate scale factors
      const scaleX = newWidth / originalWidth;
      const scaleY = newHeight / originalHeight;

      // Apply scaling to all selected components
      bounds.components.forEach(component => {
        // Calculate relative position within the bounding box
        const relativeX = (component.position.x - originalLeft) / originalWidth;
        const relativeY = (component.position.y - originalTop) / originalHeight;
        const relativeWidth = component.size.width / originalWidth;
        const relativeHeight = component.size.height / originalHeight;

        // Calculate new position and size
        const newComponentX = newX + (relativeX * newWidth);
        const newComponentY = newY + (relativeY * newHeight);
        const newComponentWidth = Math.max(minSize, relativeWidth * newWidth);
        const newComponentHeight = Math.max(minSize, relativeHeight * newHeight);

        // Apply grid snapping if enabled
        let finalX = newComponentX;
        let finalY = newComponentY;
        let finalWidth = newComponentWidth;
        let finalHeight = newComponentHeight;

        if (showGrid) {
          finalX = snapToGrid(finalX, 'width');
          finalY = snapToGrid(finalY, 'height');
          finalWidth = snapToGrid(finalWidth, 'width');
          finalHeight = snapToGrid(finalHeight, 'height');
        }

        onUpdateComponent(component.id, {
          position: { x: finalX, y: finalY },
          size: { width: finalWidth, height: finalHeight }
        });
      });

      return;
    }

    // Single component resize logic (existing code)
    const currentLeft = draggedComponent.position.x;
    const currentTop = draggedComponent.position.y;
    const currentWidth = draggedComponent.size.width;
    const currentHeight = draggedComponent.size.height;

    // Calculate original aspect ratio
    const aspectRatio = currentWidth / currentHeight;

    let newWidth = currentWidth;
    let newHeight = currentHeight;
    let newX = currentLeft;
    let newY = currentTop;

    const minSize = 20;

    switch (resizeHandle) {
      case 'se': // Bottom-right
        newWidth = Math.max(minSize, canvasX - currentLeft);
        newHeight = Math.max(minSize, canvasY - currentTop);
        if (maintainAspectRatio) {
          // Use width to determine height
          newHeight = newWidth / aspectRatio;
        }
        break;
      case 'sw': // Bottom-left
        newWidth = Math.max(minSize, currentLeft + currentWidth - canvasX);
        newHeight = Math.max(minSize, canvasY - currentTop);
        if (maintainAspectRatio) {
          // Use width to determine height
          newHeight = newWidth / aspectRatio;
        }
        newX = canvasX;
        break;
      case 'ne': // Top-right
        newWidth = Math.max(minSize, canvasX - currentLeft);
        newHeight = Math.max(minSize, currentTop + currentHeight - canvasY);
        if (maintainAspectRatio) {
          // Use width to determine height, then adjust Y position
          const calculatedHeight = newWidth / aspectRatio;
          newY = currentTop + currentHeight - calculatedHeight;
          newHeight = calculatedHeight;
        }
        newY = maintainAspectRatio ? newY : canvasY;
        break;
      case 'nw': // Top-left
        newWidth = Math.max(minSize, currentLeft + currentWidth - canvasX);
        newHeight = Math.max(minSize, currentTop + currentHeight - canvasY);
        if (maintainAspectRatio) {
          // Use width to determine height, then adjust both X and Y positions
          const calculatedHeight = newWidth / aspectRatio;
          newY = currentTop + currentHeight - calculatedHeight;
          newHeight = calculatedHeight;
        }
        newX = canvasX;
        newY = maintainAspectRatio ? newY : canvasY;
        break;
    }

    // Only snap to grid during resizing if grid is enabled
    if (showGrid) {
      newWidth = snapToGrid(newWidth, 'width');
      newHeight = snapToGrid(newHeight, 'height');
      newX = snapToGrid(newX, 'width');
      newY = snapToGrid(newY, 'height');
    }

    // Store pixel values directly
    onUpdateComponent(draggedComponent.id, {
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight }
    });
  }, [draggedComponent, resizeHandle, snapToGrid, onUpdateComponent, showGrid, selectedComponents, getMultiSelectBounds]);

  // Update the ref whenever handleResize changes
  handleResizeRef.current = handleResize;

  // Handle resize handle mouse down
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string, component: ComponentConfig) => {
    // Prevent synthetic touch events from interfering
    if (e.type === 'touchstart') {
      e.preventDefault();
    } else {
      e.preventDefault();
    }
    e.stopPropagation();
    
    onStartDragOperation(); // Save initial state for undo
    setIsResizing(true);
    setResizeHandle(handle);
    setDraggedComponent(component);
    handleComponentSelect(component.id, false); // Single select for resize
  }, [handleComponentSelect, setDraggedComponent, onStartDragOperation]);

  // Helper function to check if a point is inside a visible component
  const getComponentAtPoint = useCallback((x: number, y: number) => {
    return (layout.components || [])
      .filter(component => component.visible !== false) // Only check visible components
      .find(component => {
        // Positions and sizes are already in pixels
        const left = component.position.x;
        const top = component.position.y;
        const width = component.size.width;
        const height = component.size.height;
        
        return x >= left && x <= left + width && y >= top && y <= top + height;
      });
  }, [layout.components]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Handle middle mouse button for panning
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    // Check if the click is on the canvas or any non-component element
    const target = e.target as HTMLElement;
    const isHandleClick = target.closest('.canvas-handle');
    
    if (!isHandleClick && e.button === 0) { // Left mouse button only
      const rect = canvasRef.current!.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) / scale;
      const canvasY = (e.clientY - rect.top) / scale;
      
      // Reset last selected ID when clicking on empty canvas
      setLastSelectedId(null);
      
      // Check if we're clicking inside an unselected component
      const componentAtPoint = getComponentAtPoint(canvasX, canvasY);
      
      if (componentAtPoint && !selectedComponents.includes(componentAtPoint.id)) {
        // Clicking inside an unselected component - start creating a new component
        setIsCreating(true);
        setCreateStart({ x: canvasX, y: canvasY });
        setCreateEnd({ x: canvasX, y: canvasY });
        // Don't change selection - keep the current component unselected
        
        // Prevent synthetic touch events from interfering
        if (e.type === 'touchstart') {
          e.preventDefault();
        } else {
          e.preventDefault();
        }
        e.stopPropagation();
      } else if (!componentAtPoint) {
        // Clicking on empty canvas - start creating a new component
        setIsCreating(true);
        setCreateStart({ x: canvasX, y: canvasY });
        setCreateEnd({ x: canvasX, y: canvasY });
        onSelectComponents([]);
        
        // Prevent synthetic touch events from interfering
        if (e.type === 'touchstart') {
          e.preventDefault();
        } else {
          e.preventDefault();
        }
        e.stopPropagation();
      }
    }
  }, [onSelectComponents, scale, getComponentAtPoint, selectedComponents, setLastSelectedId]);

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    // Check if Cmd (Mac) or Ctrl (Windows/Linux) is held
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      
      // Determine zoom direction and amount
      const zoomDelta = e.deltaY > 0 ? -10 : 10; // Reverse direction (scroll up = zoom in)
      const newZoomLevel = Math.max(10, Math.min(200, zoomLevel + zoomDelta));
      
      // Just change zoom level - don't adjust viewport offset
      setZoomLevel(newZoomLevel);
    }
  }, [zoomLevel]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if user is typing in an input field - if so, don't intercept keys
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' || 
      activeElement.tagName === 'SELECT' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      // Check if the active element is inside the property panel
      activeElement.closest('.property-panel') !== null
    );

    // Always allow grid and center line toggles (unless typing)
    if (!isInputFocused) {
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowGrid(prev => !prev);
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHalfwayLines(prev => !prev);
        return;
      }
    }

    // Only handle delete/backspace if not typing in an input field
    if (selectedComponents.length > 0 && !isInputFocused) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        selectedComponents.forEach(componentId => {
          onDeleteComponent(componentId);
        });
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectedComponents.forEach(componentId => {
          onDuplicateComponent(componentId);
        });
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        // Undo functionality - pass through to parent
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('canvas-undo'));
        }
      } else if ((e.key === 'y' && (e.metaKey || e.ctrlKey)) || (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey)) {
        e.preventDefault();
        // Redo functionality - pass through to parent (Ctrl+Y or Ctrl+Shift+Z)
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('canvas-redo'));
        }
      }
    }
  }, [selectedComponents, onDeleteComponent, onDuplicateComponent]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getComponentHandle = (component: ComponentConfig) => {
    // Positions and sizes are already in pixels
    const left = component.position.x;
    const top = component.position.y;
    const width = component.size.width;
    const height = component.size.height;

    // Calculate border widths
    const borderTopWidth = component.props?.borderTopWidth !== undefined ? component.props.borderTopWidth : (component.props?.borderWidth || 0);
    const borderRightWidth = component.props?.borderRightWidth !== undefined ? component.props.borderRightWidth : (component.props?.borderWidth || 0);
    const borderBottomWidth = component.props?.borderBottomWidth !== undefined ? component.props.borderBottomWidth : (component.props?.borderWidth || 0);
    const borderLeftWidth = component.props?.borderLeftWidth !== undefined ? component.props.borderLeftWidth : (component.props?.borderWidth || 0);
    
    // Check if any border has width > 0
    const hasBorder = borderTopWidth > 0 || borderRightWidth > 0 || borderBottomWidth > 0 || borderLeftWidth > 0;

    const baseStyle = {
      position: 'absolute' as const,
      left,
      top,
      width,
      height,
      boxSizing: 'border-box' as const,  // Include border in width/height
      borderTopWidth: borderTopWidth,
      borderRightWidth: borderRightWidth,
      borderBottomWidth: borderBottomWidth,
      borderLeftWidth: borderLeftWidth,
      borderStyle: hasBorder ? (component.props?.borderStyle || 'solid') : 'none',
      borderColor: hasBorder ? (component.props?.borderColor || '#666') : 'transparent',
      boxShadow: selectedComponents.includes(component.id) ? '0 0 0 2px #4CAF50' : 'none',
      backgroundColor: component.props?.backgroundColor || getComponentColor(component),
      borderTopLeftRadius: component.props?.borderTopLeftRadius || 0,
      borderTopRightRadius: component.props?.borderTopRightRadius || 0,
      borderBottomLeftRadius: component.props?.borderBottomLeftRadius || 0,
      borderBottomRightRadius: component.props?.borderBottomRightRadius || 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'move',
      userSelect: 'none' as const
    };

    const isSelected = selectedComponents.includes(component.id);
    
    return (
      <div
        key={component.id}
        style={{
          ...baseStyle,
          backgroundColor: 'transparent',
          pointerEvents: 'auto', // Always capture events for component interaction
          zIndex: isSelected ? 10 : 5, // Selected components on top
        }}
        onMouseDown={(e) => handleMouseDown(e, component)}
        className="canvas-handle"
      >
        {selectedComponents.includes(component.id) && selectedComponents.length === 1 && (
          <>
            {/* Resize handles - only show for single selection */}
            <div
              className="resize-handle resize-handle-nw"
              onMouseDown={(e) => handleResizeMouseDown(e, 'nw', component)}
              style={{ top: -4, left: -4 }}
            />
            <div
              className="resize-handle resize-handle-ne"
              onMouseDown={(e) => handleResizeMouseDown(e, 'ne', component)}
              style={{ top: -4, right: -4 }}
            />
            <div
              className="resize-handle resize-handle-sw"
              onMouseDown={(e) => handleResizeMouseDown(e, 'sw', component)}
              style={{ bottom: -4, left: -4 }}
            />
            <div
              className="resize-handle resize-handle-se"
              onMouseDown={(e) => handleResizeMouseDown(e, 'se', component)}
              style={{ bottom: -4, right: -4 }}
            />
            
            {/* Control buttons */}
            <div className="component-controls">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateComponent(component.id);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  // Create duplicate immediately at the button's position
                  const rect = canvasRef.current!.getBoundingClientRect();
                  const buttonX = (e.clientX - rect.left) / scale;
                  const buttonY = (e.clientY - rect.top) / scale;
                  
                  // Create the duplicate
                  onStartDragOperation();
                  onDuplicateComponent(component.id);
                  
                  // Set up drag state for the new component (it will be the last one added)
                  setTimeout(() => {
                    const components = layoutRef.current.components;
                    const newComponent = components[components.length - 1];
                    if (newComponent) {
                      // Move the duplicate to where the button was clicked
                      const newPosition = {
                        x: buttonX - newComponent.size.width / 2,
                        y: buttonY - newComponent.size.height / 2
                      };
                      
                      // Update position immediately (preserve original layer)
                      onUpdateComponent(newComponent.id, {
                        position: newPosition
                      });
                      
                      // Select the new component and start dragging it
                      onSelectComponents([newComponent.id]);
                      setDraggedComponent({ ...newComponent, position: newPosition });
                      setIsDragging(true);
                      setDragOffset({
                        x: newComponent.size.width / 2,
                        y: newComponent.size.height / 2
                      });
                    }
                  }, 10);
                }}
                className="control-button duplicate"
                title="Duplicate (drag to position)"
              >
                📋
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteComponent(component.id);
                }}
                className="control-button delete"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const displayWidth = layout.dimensions.width * scale;
  const displayHeight = layout.dimensions.height * scale;

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <div className="canvas-info">
          Canvas: {layout.dimensions.width} × {layout.dimensions.height}px
        </div>
        <div className="resolution-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            value={selectedPreset} 
            onChange={(e) => handleResolutionChange(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: '#fff'
            }}
          >
            {RESOLUTION_PRESETS.map(preset => (
              <option key={preset.name} value={preset.name}>
                {preset.name === 'Custom' ? preset.name : `${preset.name} (${preset.width}×${preset.height})`}
              </option>
            ))}
          </select>
          {selectedPreset === 'Custom' && (
            <>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="Width"
                style={{
                  width: '60px',
                  padding: '4px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
              ×
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="Height"
                style={{
                  width: '60px',
                  padding: '4px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
              <button
                onClick={handleCustomResolution}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer'
                }}
                title="Apply custom resolution"
              >
                Apply
              </button>
            </>
          )}
        </div>
        <div className="canvas-controls">
          <button 
            className={`grid-button ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid (G)"
          >
            ⊞ Grid
          </button>
          <button 
            className={`grid-button ${showHalfwayLines ? 'active' : ''}`}
            onClick={() => setShowHalfwayLines(!showHalfwayLines)}
            title="Toggle Center Lines (H)"
          >
            ╬ Center
          </button>
          <div className="grid-size-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="grid-button"
              onClick={decreaseGridSize}
              title="Decrease grid size"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              −
            </button>
            <span
              className="grid-info"
              style={{
                minWidth: '40px',
                textAlign: 'center',
                fontSize: '12px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px'
              }}
              title="Current grid size"
            >
              {gridSize}px
            </span>
            <button
              className="grid-button"
              onClick={increaseGridSize}
              title="Increase grid size"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              +
            </button>
          </div>
          {/* Snap Strength Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Snap:</span>
            <button
              className="grid-button"
              onClick={() => setSnapThresholdIndex(Math.max(0, snapThresholdIndex - 1))}
              title="Decrease snap strength (less sticky)"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              −
            </button>
            <span
              style={{
                minWidth: '40px',
                textAlign: 'center',
                fontSize: '12px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px'
              }}
              title={`Snap strength: ${snapThreshold}px threshold`}
            >
              {snapThreshold}px
            </span>
            <button
              className="grid-button"
              onClick={() => setSnapThresholdIndex(Math.min(SNAP_THRESHOLD_OPTIONS.length - 1, snapThresholdIndex + 1))}
              title="Increase snap strength (stickier)"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              +
            </button>
          </div>
        </div>
        <div className="canvas-zoom">
          <button 
            onClick={() => {
              const maxWidth = window.innerWidth - 650;
              const maxHeight = window.innerHeight - 160;
              const scaleX = maxWidth / layout.dimensions.width;
              const scaleY = maxHeight / layout.dimensions.height;
              const fitScale = Math.min(scaleX, scaleY, 2.0); // Allow fit up to 200%
              setZoomLevel(Math.round(fitScale * 100));
              setViewportOffset({ x: 0, y: 0 }); // Reset panning when fitting
            }}
            style={{fontSize: '11px', padding: '4px 8px', marginRight: '8px'}}
          >
            Fit
          </button>
          <label style={{fontSize: '12px', marginRight: '8px'}}>Zoom:</label>
          <input 
            type="range" 
            min="10" 
            max="200" 
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseInt(e.target.value))}
            style={{width: '100px', marginRight: '8px'}}
          />
          <span>{zoomLevel}%</span>
        </div>
      </div>
      
      <div 
        className="canvas-wrapper" 
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '20px',
          minWidth: displayWidth,
          minHeight: displayHeight
        }}
        onMouseDown={(e) => {
          // Prevent browser default middle-click behavior (like opening links in new tabs)
          if (e.button === 1) {
            e.preventDefault();
          }
        }}
      >
        <div 
          ref={canvasRef}
          className="canvas"
          style={{
            width: layout.dimensions.width,
            height: layout.dimensions.height,
            backgroundColor: layout.backgroundColor,
            transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            position: 'relative',
            cursor: isPanning ? 'grabbing' : 'default'
          }}
        onMouseMove={handleMouseMove}
        onMouseUp={(e) => handleMouseUp(e)}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleCanvasWheel}
        onDragOver={(e) => {
          e.preventDefault(); // Allow drop
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'preset-component') {
              // Get canvas coordinates
              const canvasRect = canvasRef.current?.getBoundingClientRect();
              if (canvasRect) {
                const x = (e.clientX - canvasRect.left) / scale;
                const y = (e.clientY - canvasRect.top) / scale;

                // Create component at drop position
                onAddComponent(
                  data.componentType,
                  { x: x - (data.size?.width || 250) / 2, y: y - (data.size?.height || 250) / 2 },
                  data.size
                );

                // If we have preset props, update the newly created component
                if (data.props) {
                  requestAnimationFrame(() => {
                    const components = layout.components;
                    const newComponent = components[components.length - 1];
                    if (newComponent) {
                      onUpdateComponent(newComponent.id, { props: data.props });
                    }
                  });
                }
              }
            }
          } catch (err) {
            console.error('Failed to parse drop data:', err);
          }
        }}
      >
        <div
          style={{
            width: layout.dimensions.width,
            height: layout.dimensions.height,
          }}
        >
          {/* Simple pixel-based grid overlay */}
          {showGrid && (
            <svg
              width={layout.dimensions.width}
              height={layout.dimensions.height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              <defs>
                <pattern
                  id="pixel-grid"
                  width={gridSize}
                  height={gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <rect 
                    width={gridSize} 
                    height={gridSize} 
                    fill="none" 
                    stroke="rgba(255, 255, 255, 0.3)" 
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect 
                width={layout.dimensions.width} 
                height={layout.dimensions.height} 
                fill="url(#pixel-grid)" 
              />
              {/* Add center snap lines for large grid sizes */}
              {gridSize >= 50 && (
                <>
                  {/* Vertical center line */}
                  <line
                    x1={layout.dimensions.width / 2}
                    y1={0}
                    x2={layout.dimensions.width / 2}
                    y2={layout.dimensions.height}
                    stroke="rgba(255, 255, 0, 0.6)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                  {/* Horizontal center line */}
                  <line
                    x1={0}
                    y1={layout.dimensions.height / 2}
                    x2={layout.dimensions.width}
                    y2={layout.dimensions.height / 2}
                    stroke="rgba(255, 255, 0, 0.6)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                </>
              )}
            </svg>
          )}

          {/* Center lines positioned at exact middle of canvas */}
          {showHalfwayLines && (
            <>
              {/* Vertical center line */}
              <div
                style={{
                  position: 'absolute',
                  left: layout.dimensions.width / 2,
                  top: 0,
                  width: '1px',
                  height: layout.dimensions.height,
                  backgroundColor: 'rgba(255, 255, 0, 0.8)',
                  boxShadow: '0 0 4px rgba(255, 255, 0, 0.4)',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
              {/* Horizontal center line */}
              <div
                style={{
                  position: 'absolute',
                  top: layout.dimensions.height / 2,
                  left: 0,
                  width: layout.dimensions.width,
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 0, 0.8)',
                  boxShadow: '0 0 4px rgba(255, 255, 0, 0.4)',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
            </>
          )}

          {/* Smart Guides Overlay - shows alignment guides when dragging */}
          {activeGuides.guides.length > 0 && (
            <svg
              width={layout.dimensions.width}
              height={layout.dimensions.height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 9999
              }}
            >
              {activeGuides.guides.map((guide, index) => {
                // Define colors for different guide types
                const colors = {
                  'center-h': '#FF00FF', // Magenta for center
                  'center-v': '#FF00FF',
                  'edge-top': '#00FFFF', // Cyan for edges
                  'edge-bottom': '#00FFFF',
                  'edge-left': '#00FFFF',
                  'edge-right': '#00FFFF',
                  'element-center-h': '#00FF00', // Green for element-to-element
                  'element-center-v': '#00FF00'
                };
                const color = colors[guide.type] || '#FF00FF';

                // Render the guide line
                if (guide.type === 'center-v' || guide.type === 'edge-left' || guide.type === 'edge-right' || guide.type === 'element-center-v') {
                  // Vertical line
                  return (
                    <g key={`guide-${index}`}>
                      <line
                        x1={guide.position}
                        y1={0}
                        x2={guide.position}
                        y2={layout.dimensions.height}
                        stroke={color}
                        strokeWidth="1"
                        strokeDasharray={guide.type.includes('center') ? '8,4' : 'none'}
                      />
                      {/* Glow effect */}
                      <line
                        x1={guide.position}
                        y1={0}
                        x2={guide.position}
                        y2={layout.dimensions.height}
                        stroke={color}
                        strokeWidth="3"
                        strokeOpacity="0.3"
                        strokeDasharray={guide.type.includes('center') ? '8,4' : 'none'}
                      />
                      {/* Center indicator circle */}
                      {guide.type === 'center-v' && activeGuides.elementBounds && (
                        <circle
                          cx={guide.position}
                          cy={activeGuides.elementBounds.centerY}
                          r="6"
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                } else {
                  // Horizontal line
                  return (
                    <g key={`guide-${index}`}>
                      <line
                        x1={0}
                        y1={guide.position}
                        x2={layout.dimensions.width}
                        y2={guide.position}
                        stroke={color}
                        strokeWidth="1"
                        strokeDasharray={guide.type.includes('center') ? '8,4' : 'none'}
                      />
                      {/* Glow effect */}
                      <line
                        x1={0}
                        y1={guide.position}
                        x2={layout.dimensions.width}
                        y2={guide.position}
                        stroke={color}
                        strokeWidth="3"
                        strokeOpacity="0.3"
                        strokeDasharray={guide.type.includes('center') ? '8,4' : 'none'}
                      />
                      {/* Center indicator circle */}
                      {guide.type === 'center-h' && activeGuides.elementBounds && (
                        <circle
                          cx={activeGuides.elementBounds.centerX}
                          cy={guide.position}
                          r="6"
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                }
              })}
            </svg>
          )}

          <WebPreview
            layout={layout}
            selectedComponents={selectedComponents}
            onSelectComponents={onSelectComponents}
            gameData={gameData}
          />
          {/* Creation rectangle overlay */}
          {isCreating && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(createStart.x, createEnd.x),
                top: Math.min(createStart.y, createEnd.y),
                width: Math.abs(createEnd.x - createStart.x),
                height: Math.abs(createEnd.y - createStart.y),
                border: '2px dashed #4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                pointerEvents: 'none',
                zIndex: 1000
              }}
            />
          )}
          
          {/* Overlay draggable handles - sorted by layer, only show visible components */}
          {[...(layout.components || [])]
            .filter(component => component.visible !== false) // Show components that are explicitly visible or undefined (default true)
            .sort((a, b) => (a.layer || 0) - (b.layer || 0))
            .map(component => getComponentHandle(component))}

          {/* Multi-select bounding box */}
          {selectedComponents.length > 1 && (() => {
            const bounds = getMultiSelectBounds();
            if (!bounds) return null;

            return (
              <div
                key="multi-select-bounds"
                style={{
                  position: 'absolute',
                  left: bounds.x,
                  top: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                  border: '2px dashed #4CAF50',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              >
                {/* Multi-select resize handles */}
                <div
                  className="resize-handle resize-handle-nw"
                  onMouseDown={(e) => handleMultiResizeMouseDown(e, 'nw')}
                  style={{
                    top: -4,
                    left: -4,
                    pointerEvents: 'auto',
                    backgroundColor: '#4CAF50',
                    border: '1px solid #ffffff'
                  }}
                />
                <div
                  className="resize-handle resize-handle-ne"
                  onMouseDown={(e) => handleMultiResizeMouseDown(e, 'ne')}
                  style={{
                    top: -4,
                    right: -4,
                    pointerEvents: 'auto',
                    backgroundColor: '#4CAF50',
                    border: '1px solid #ffffff'
                  }}
                />
                <div
                  className="resize-handle resize-handle-sw"
                  onMouseDown={(e) => handleMultiResizeMouseDown(e, 'sw')}
                  style={{
                    bottom: -4,
                    left: -4,
                    pointerEvents: 'auto',
                    backgroundColor: '#4CAF50',
                    border: '1px solid #ffffff'
                  }}
                />
                <div
                  className="resize-handle resize-handle-se"
                  onMouseDown={(e) => handleMultiResizeMouseDown(e, 'se')}
                  style={{
                    bottom: -4,
                    right: -4,
                    pointerEvents: 'auto',
                    backgroundColor: '#4CAF50',
                    border: '1px solid #ffffff'
                  }}
                />

                {/* Multi-select info label */}
                <div
                  style={{
                    position: 'absolute',
                    top: -24,
                    left: 0,
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '2px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    pointerEvents: 'none'
                  }}
                >
                  {selectedComponents.length} selected
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  </div>
  );
}

function getComponentColor(component: ComponentConfig): string {
  const colors = {
    teamName: '#4CAF50',
    score: '#2196F3',
    clock: '#FF9800',
    period: '#9C27B0',
    fouls: '#F44336',
    timeouts: '#607D8B',
    bonus: '#FFEB3B',
    custom: '#795548',
    dynamicList: '#009688'
  };
  return colors[component.type] || '#666';
}