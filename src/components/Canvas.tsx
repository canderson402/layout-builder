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

// Pixel-based grid settings
const DEFAULT_GRID_SIZE = 20;
const SNAP_THRESHOLD = 5;
const GRID_SIZE_OPTIONS = [5, 10, 20]; // Grid spacing options in pixels

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
  const [gridSizeIndex, setGridSizeIndex] = useState(2); // Default to 20px grid (index 2)
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
    if (Math.abs(value - center) <= SNAP_THRESHOLD) {
      return center;
    }
    
    // For larger grid sizes, add center as an additional snap point
    if (gridSize >= 50) {
      const regularSnap = Math.round(value / gridSize) * gridSize;
      const distToRegular = Math.abs(value - regularSnap);
      const distToCenter = Math.abs(value - center);
      
      // If we're closer to center than regular grid, snap to center
      if (distToCenter < distToRegular && distToCenter <= SNAP_THRESHOLD) {
        return center;
      }
      
      return regularSnap;
    }
    
    // For smaller grid sizes, use regular snapping
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize, layout.dimensions.width, layout.dimensions.height]);

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
      
      // Component position is already in pixels
      setDragOffset({
        x: canvasX - component.position.x,
        y: canvasY - component.position.y
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
      const originalX = draggedComponent.position.x;
      const originalY = draggedComponent.position.y;
      const rawDeltaX = rawX - originalX;
      const rawDeltaY = rawY - originalY;

      // Component size is already in pixels
      let compWidth = draggedComponent.size.width;
      let compHeight = draggedComponent.size.height;
      
      // Only snap component size to grid if grid is enabled
      if (showGrid) {
        compWidth = snapToGrid(compWidth, 'width');
        compHeight = snapToGrid(compHeight, 'height');
      }
      
      let newX = rawX;
      let newY = rawY;

      // Only snap to grid if grid is enabled
      if (showGrid) {
        newX = snapToGrid(newX, 'width');
        newY = snapToGrid(newY, 'height');
      }

      // Update the primary dragged component with pixel values
      onUpdateComponent(draggedComponent.id, {
        position: { x: newX, y: newY },
        size: { width: compWidth, height: compHeight }
      });

      // If multiple components are selected, move them all by the raw mouse delta
      if (selectedComponentsRef.current.length > 1) {
        selectedComponentsRef.current.forEach(componentId => {
          if (componentId !== draggedComponent.id) {
            const component = layoutRef.current.components.find(c => c.id === componentId);
            if (component) {
              // Position is already in pixels
              const currentX = component.position.x;
              const currentY = component.position.y;
              
              // Move by the raw mouse movement delta (not the snapped delta)
              let movedX = currentX + rawDeltaX;
              let movedY = currentY + rawDeltaY;
              
              onUpdateComponent(componentId, {
                position: { x: movedX, y: movedY }
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
  }, [setDraggedComponent, isCreating, createStart, createEnd, snapToGrid, layout.dimensions, onAddComponent, showGrid, draggedComponent, isDragging, hasDraggedFarEnough, selectedComponents, handleComponentSelect, isResizing, onEndDragOperation, layout.components, isPanning]);

  // Handle resize logic
  const handleResize = useCallback((canvasX: number, canvasY: number) => {
    if (!draggedComponent) return;

    // Component values are already in pixels
    const currentLeft = draggedComponent.position.x;
    const currentTop = draggedComponent.position.y;
    const currentWidth = draggedComponent.size.width;
    const currentHeight = draggedComponent.size.height;

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
      newWidth = snapToGrid(newWidth, 'width');
      newHeight = snapToGrid(newHeight, 'height');
      newX = snapToGrid(newX, 'width');
      newY = snapToGrid(newY, 'height');
    }

    // No boundary constraints - allow resizing off grid

    // Store pixel values directly
    onUpdateComponent(draggedComponent.id, {
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight }
    });
  }, [draggedComponent, resizeHandle, snapToGrid, shouldSnap, onUpdateComponent, showGrid]);

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