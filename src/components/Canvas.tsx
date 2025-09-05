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
}

// Default grid settings
const DEFAULT_GRID_SIZE = 10;
const SNAP_THRESHOLD = 5; // Reduced threshold to prevent snapping between grid lines

// Helper functions to convert between percentages and pixels (moved to top)
const percentToPixels = (percent: number, total: number) => (percent / 100) * total;
const pixelsToPercent = (pixels: number, total: number) => (pixels / total) * 100;

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
  onEndDragOperation
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
  const [gridSizeIndex, setGridSizeIndex] = useState(0); // Track which size (small/medium/large) is selected
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(50); // Zoom level from 10% to 200%
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState({ x: 0, y: 0 });
  const [createEnd, setCreateEnd] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasDraggedFarEnough, setHasDraggedFarEnough] = useState(false);
  
  // Viewport panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  
  // Throttle drag updates for better performance
  const lastUpdateTime = useRef(0);
  const THROTTLE_MS = 16; // ~60fps

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

  // Perfect grid calculation function for 100% coverage
  const calculatePerfectGrid = useCallback((width: number, height: number, targetCellSize: number) => {
    const cols = Math.floor(width / targetCellSize);
    const rows = Math.floor(height / targetCellSize);
    
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    
    return {
      cols,
      rows,
      cellWidth,
      cellHeight,
      totalCells: cols * rows,
      actualWidth: cols * cellWidth,
      actualHeight: rows * cellHeight
    };
  }, []);

  // Calculate smart grid sizes that scale with zoom level
  const calculateSmartGridSizes = useCallback(() => {
    const width = layout.dimensions.width;   // e.g., 1920
    const height = layout.dimensions.height; // e.g., 1080
    
    // Base target sizes that will be adjusted by zoom
    const BASE_TARGET_SIZES = {
      small: 30,    // Base ~30px cells
      medium: 50,   // Base ~50px cells  
      large: 80     // Base ~80px cells
    };
    
    // Scale target sizes based on zoom level for finer control when zoomed in
    // At 100% zoom: use base sizes
    // At 200% zoom: use smaller grid cells for more precision
    // At 50% zoom: use larger grid cells to avoid clutter
    const zoomFactor = Math.max(0.3, Math.min(2.0, 100 / zoomLevel)); // Inverse relationship
    
    const TARGET_SIZES = {
      small: BASE_TARGET_SIZES.small * zoomFactor,
      medium: BASE_TARGET_SIZES.medium * zoomFactor,  
      large: BASE_TARGET_SIZES.large * zoomFactor
    };
    
    // Calculate perfect grids for each size
    const smallGrid = calculatePerfectGrid(width, height, TARGET_SIZES.small);
    const mediumGrid = calculatePerfectGrid(width, height, TARGET_SIZES.medium);
    const largeGrid = calculatePerfectGrid(width, height, TARGET_SIZES.large);
    
    return [
      smallGrid.cellWidth,   // Perfect cell width for small grid
      mediumGrid.cellWidth,  // Perfect cell width for medium grid
      largeGrid.cellWidth    // Perfect cell width for large grid
    ];
  }, [layout.dimensions.width, layout.dimensions.height, calculatePerfectGrid, zoomLevel]);

  const GRID_SIZES = calculateSmartGridSizes();
  const GRID_SIZE_LABELS = ['Small', 'Medium', 'Large'];
  const gridSize = GRID_SIZES[gridSizeIndex] || GRID_SIZES[0];

  const toggleGridSize = () => {
    const nextIndex = (gridSizeIndex + 1) % GRID_SIZES.length;
    setGridSizeIndex(nextIndex);
  };

  const getCurrentGridLabel = () => {
    return GRID_SIZE_LABELS[gridSizeIndex] || 'Small';
  };

  // Perfect grid snapping functions
  const snapToGrid = useCallback((value: number) => {
    const BASE_TARGET_SIZES = { small: 30, medium: 50, large: 80 };
    const zoomFactor = Math.max(0.3, Math.min(2.0, 100 / zoomLevel)); // Same zoom factor as grid calculation
    const adjustedTargetSize = BASE_TARGET_SIZES[['small', 'medium', 'large'][gridSizeIndex] as keyof typeof BASE_TARGET_SIZES] * zoomFactor;
    const perfectGrid = calculatePerfectGrid(layout.dimensions.width, layout.dimensions.height, adjustedTargetSize);
    
    // Snap to perfect grid cells
    return Math.round(value / perfectGrid.cellWidth) * perfectGrid.cellWidth;
  }, [gridSizeIndex, layout.dimensions.width, layout.dimensions.height, calculatePerfectGrid, zoomLevel]);

  const shouldSnap = useCallback((value: number, snappedValue: number) => {
    return Math.abs(value - snappedValue) <= SNAP_THRESHOLD;
  }, []);

  // Use manual zoom level (10% to 200%)
  const scale = zoomLevel / 100;

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
    
    // Handle selection logic
    if (isCtrlClick) {
      // Ctrl+click: toggle this component in the selection
      handleComponentSelect(component.id, true);
      return;
    } else if (isAlreadySelected) {
      // Component is already selected - prepare for potential drag
      setDraggedComponent(component);
      
      // Convert component position from percentage to pixels for drag offset calculation
      const componentPixelX = percentToPixels(component.position.x, layout.dimensions.width);
      const componentPixelY = percentToPixels(component.position.y, layout.dimensions.height);
      
      setDragOffset({
        x: canvasX - componentPixelX,
        y: canvasY - componentPixelY
      });
    } else {
      // Click on unselected component - prepare for potential creation
      // We'll decide in mouse move whether to select or start creating
      setDraggedComponent(component);
    }
  }, [handleComponentSelect, setDraggedComponent, layout.dimensions, scale, selectedComponents]);

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
          // Notify PropertyPanel to pause expensive rendering
          window.dispatchEvent(new CustomEvent('canvas-drag-start'));
        } else {
          // Start creating new component inside unselected component
          setIsCreating(true);
          setCreateStart({ x: dragStartPos.x, y: dragStartPos.y });
          setCreateEnd({ x: canvasX, y: canvasY });
          setDraggedComponent(null); // Clear this since we're creating, not dragging
          return;
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
      const originalX = percentToPixels(draggedComponent.position.x, layoutRef.current.dimensions.width);
      const originalY = percentToPixels(draggedComponent.position.y, layoutRef.current.dimensions.height);
      const rawDeltaX = rawX - originalX;
      const rawDeltaY = rawY - originalY;

      // Convert current component size from percentages to pixels
      let compWidth = percentToPixels(draggedComponent.size.width, layoutRef.current.dimensions.width);
      let compHeight = percentToPixels(draggedComponent.size.height, layoutRef.current.dimensions.height);
      
      // Only snap component size to grid if grid is enabled
      if (showGrid) {
        compWidth = snapToGrid(compWidth);
        compHeight = snapToGrid(compHeight);
      }
      
      let newX = rawX;
      let newY = rawY;

      // Only snap to grid if grid is enabled
      if (showGrid) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      // Convert back to percentages for storage
      const newPercentX = pixelsToPercent(newX, layoutRef.current.dimensions.width);
      const newPercentY = pixelsToPercent(newY, layoutRef.current.dimensions.height);
      const newPercentWidth = pixelsToPercent(compWidth, layoutRef.current.dimensions.width);
      const newPercentHeight = pixelsToPercent(compHeight, layoutRef.current.dimensions.height);

      // Update the primary dragged component
      onUpdateComponent(draggedComponent.id, {
        position: { x: newPercentX, y: newPercentY },
        size: { width: newPercentWidth, height: newPercentHeight }
      });

      // If multiple components are selected, move them all by the raw mouse delta
      if (selectedComponentsRef.current.length > 1) {
        selectedComponentsRef.current.forEach(componentId => {
          if (componentId !== draggedComponent.id) {
            const component = layoutRef.current.components.find(c => c.id === componentId);
            if (component) {
              const currentX = percentToPixels(component.position.x, layoutRef.current.dimensions.width);
              const currentY = percentToPixels(component.position.y, layoutRef.current.dimensions.height);
              
              // Move by the raw mouse movement delta (not the snapped delta)
              let movedX = currentX + rawDeltaX;
              let movedY = currentY + rawDeltaY;
              
              const movedPercentX = pixelsToPercent(movedX, layoutRef.current.dimensions.width);
              const movedPercentY = pixelsToPercent(movedY, layoutRef.current.dimensions.height);
              
              onUpdateComponent(componentId, {
                position: { x: movedPercentX, y: movedPercentY }
              });
            }
          }
        });
      }
    }

    if (isResizing) {
      // Handle resizing logic here
      handleResize(canvasX, canvasY);
    }
  }, [isDragging, isResizing, draggedComponent, dragOffset, onUpdateComponent, snapToGrid, scale, showGrid, isPanning, isCreating, panStart, viewportOffset]);

  const handleMouseUp = useCallback(() => {
    // Handle viewport panning end
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    // Handle case where we clicked on unselected component but didn't drag (should just select)
    if (draggedComponent && !isDragging && !isCreating && !hasDraggedFarEnough) {
      const isAlreadySelected = selectedComponents.includes(draggedComponent.id);
      if (!isAlreadySelected) {
        handleComponentSelect(draggedComponent.id, false);
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
        const snappedLeft = showGrid ? snapToGrid(left) : left;
        const snappedTop = showGrid ? snapToGrid(top) : top;
        const snappedWidth = showGrid ? snapToGrid(width) : width;
        const snappedHeight = showGrid ? snapToGrid(height) : height;
        
        // Create component with the dragged dimensions
        const position = {
          x: pixelsToPercent(snappedLeft, layout.dimensions.width),
          y: pixelsToPercent(snappedTop, layout.dimensions.width)
        };
        const size = {
          width: pixelsToPercent(snappedWidth, layout.dimensions.width),
          height: pixelsToPercent(snappedHeight, layout.dimensions.width)
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
      const component = layout.components.find(c => c.id === draggedComponent.id);
      if (component) {
        onEndDragOperation(`Move ${component.type} component`);
      }
      // Notify PropertyPanel to resume normal rendering
      window.dispatchEvent(new CustomEvent('canvas-drag-end'));
    } else if (isResizing && draggedComponent) {
      const component = layout.components.find(c => c.id === draggedComponent.id);
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
  }, [setDraggedComponent, isCreating, createStart, createEnd, snapToGrid, layout.dimensions, onAddComponent, pixelsToPercent, showGrid, draggedComponent, isDragging, hasDraggedFarEnough, selectedComponents, handleComponentSelect, isResizing, onEndDragOperation, layout.components, isPanning]);

  // Handle resize logic
  const handleResize = useCallback((canvasX: number, canvasY: number) => {
    if (!draggedComponent) return;

    // Convert current component values from percentages to pixels
    // Use correct dimensions: width for X/width, height for Y/height (matches rendering)
    const currentLeft = percentToPixels(draggedComponent.position.x, layout.dimensions.width);
    const currentTop = percentToPixels(draggedComponent.position.y, layout.dimensions.height);
    const currentWidth = percentToPixels(draggedComponent.size.width, layout.dimensions.width);
    const currentHeight = percentToPixels(draggedComponent.size.height, layout.dimensions.height);

    let newWidth = currentWidth;
    let newHeight = currentHeight;
    let newX = currentLeft;
    let newY = currentTop;

    const minSize = 20;

    switch (resizeHandle) {
      case 'se': // Bottom-right
        newWidth = Math.max(minSize, canvasX - currentLeft);
        newHeight = Math.max(minSize, canvasY - currentTop);
        break;
      case 'sw': // Bottom-left
        newWidth = Math.max(minSize, currentLeft + currentWidth - canvasX);
        newHeight = Math.max(minSize, canvasY - currentTop);
        newX = canvasX;
        break;
      case 'ne': // Top-right
        newWidth = Math.max(minSize, canvasX - currentLeft);
        newHeight = Math.max(minSize, currentTop + currentHeight - canvasY);
        newY = canvasY;
        break;
      case 'nw': // Top-left
        newWidth = Math.max(minSize, currentLeft + currentWidth - canvasX);
        newHeight = Math.max(minSize, currentTop + currentHeight - canvasY);
        newX = canvasX;
        newY = canvasY;
        break;
    }

    // Only snap to grid during resizing if grid is enabled
    if (showGrid) {
      newWidth = snapToGrid(newWidth);
      newHeight = snapToGrid(newHeight);
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
    }

    // No boundary constraints - allow resizing off grid

    // Convert back to percentages for storage
    // Use correct dimensions: width for X/width, height for Y/height (matches rendering)
    const newPercentX = pixelsToPercent(newX, layout.dimensions.width);
    const newPercentY = pixelsToPercent(newY, layout.dimensions.height);
    const newPercentWidth = pixelsToPercent(newWidth, layout.dimensions.width);
    const newPercentHeight = pixelsToPercent(newHeight, layout.dimensions.height);

    onUpdateComponent(draggedComponent.id, {
      position: { x: newPercentX, y: newPercentY },
      size: { width: newPercentWidth, height: newPercentHeight }
    });
  }, [draggedComponent, resizeHandle, snapToGrid, shouldSnap, onUpdateComponent, layout.dimensions, showGrid]);

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
    return layout.components
      .filter(component => component.visible !== false) // Only check visible components
      .find(component => {
        const left = percentToPixels(component.position.x, layout.dimensions.width);
        const top = percentToPixels(component.position.y, layout.dimensions.height);
        const width = percentToPixels(component.size.width, layout.dimensions.width);
        const height = percentToPixels(component.size.height, layout.dimensions.height);
        
        return x >= left && x <= left + width && y >= top && y <= top + height;
      });
  }, [layout.components, layout.dimensions.width, layout.dimensions.height]);

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
  }, [onSelectComponents, scale, getComponentAtPoint, selectedComponents]);

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
    // Convert percentage-based positioning to pixels for display
    // Use correct dimensions: width for X/width, height for Y/height (matches WebPreview)
    const left = percentToPixels(component.position.x, layout.dimensions.width);
    const top = percentToPixels(component.position.y, layout.dimensions.height);
    const width = percentToPixels(component.size.width, layout.dimensions.width);
    const height = percentToPixels(component.size.height, layout.dimensions.height);

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
        {selectedComponents.includes(component.id) && (
          <>
            {/* Resize handles */}
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
                className="control-button duplicate"
                title="Duplicate"
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
          Canvas: {layout.dimensions.width} × {layout.dimensions.height}px (16:9)
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
          <button 
            className="grid-button"
            onClick={toggleGridSize}
            title={`Grid Size: ${getCurrentGridLabel()} (${gridSize}px) - Click to cycle`}
          >
            ⊞ {getCurrentGridLabel()}
          </button>
          <span className="grid-info">{Math.round(gridSize)}px</span>
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
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleCanvasWheel}
      >
        <div
          style={{
            width: layout.dimensions.width,
            height: layout.dimensions.height,
          }}
        >
          {/* Perfect Grid overlay with 100% coverage */}
          {showGrid && (() => {
            const BASE_TARGET_SIZES = { small: 30, medium: 50, large: 80 };
            const zoomFactor = Math.max(0.3, Math.min(2.0, 100 / zoomLevel));
            const adjustedTargetSize = BASE_TARGET_SIZES[['small', 'medium', 'large'][gridSizeIndex] as keyof typeof BASE_TARGET_SIZES] * zoomFactor;
            const perfectGrid = calculatePerfectGrid(layout.dimensions.width, layout.dimensions.height, adjustedTargetSize);
            
            return (
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
                    id="perfect-grid"
                    width={perfectGrid.cellWidth}
                    height={perfectGrid.cellHeight}
                    patternUnits="userSpaceOnUse"
                  >
                    <rect 
                      width={perfectGrid.cellWidth} 
                      height={perfectGrid.cellHeight} 
                      fill="none" 
                      stroke="rgba(255, 255, 255, 0.3)" 
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect 
                  width={layout.dimensions.width} 
                  height={layout.dimensions.height} 
                  fill="url(#perfect-grid)" 
                />
              </svg>
            );
          })()}

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

          <WebPreview 
            layout={layout}
            selectedComponents={selectedComponents}
            onSelectComponents={onSelectComponents}
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
          {[...layout.components]
            .filter(component => component.visible !== false) // Show components that are explicitly visible or undefined (default true)
            .sort((a, b) => (a.layer || 0) - (b.layer || 0))
            .map(component => getComponentHandle(component))}
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
    custom: '#795548'
  };
  return colors[component.type] || '#666';
}