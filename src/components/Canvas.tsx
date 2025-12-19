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
  type: 'center-h' | 'center-v' | 'edge-top' | 'edge-bottom' | 'edge-left' | 'edge-right' |
        'element-edge-v' | 'element-edge-h' | 'element-center-h' | 'element-center-v';
  position: number; // x for vertical lines, y for horizontal lines
  label?: string; // Optional distance label
  // For element-to-element guides, store the span for drawing the connecting line
  span?: { start: number; end: number };
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
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const [zoomLevel, setZoomLevel] = useState(60); // Zoom level from 10% to 200%
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

  // Snap type toggles
  const [snapToElements, setSnapToElements] = useState(true); // Element-to-element snapping
  const [snapToCanvasGuides, setSnapToCanvasGuides] = useState(true); // Canvas center/edge snapping
  const [isAltHeld, setIsAltHeld] = useState(false); // Alt key temporarily disables all snapping (for UI)
  const isAltHeldRef = useRef(false); // Ref for immediate access during drag

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

  // Helper function to get all descendants (children, grandchildren, etc.) of given component IDs
  const getAllDescendants = useCallback((parentIds: string[], components: ComponentConfig[]): string[] => {
    const descendants: string[] = [];
    const toProcess = [...parentIds];
    const processed = new Set<string>();

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      if (processed.has(currentId)) continue;
      processed.add(currentId);

      // Find all components that have this as their parent
      const children = components.filter(c => c.parentId === currentId);
      for (const child of children) {
        if (!parentIds.includes(child.id) && !descendants.includes(child.id)) {
          descendants.push(child.id);
          toProcess.push(child.id); // Process grandchildren too
        }
      }
    }

    return descendants;
  }, []);

  // Helper function to check if any ancestor of a component is hidden
  const isAncestorHidden = useCallback((component: ComponentConfig, components: ComponentConfig[]): boolean => {
    let currentParentId = component.parentId;
    while (currentParentId) {
      const parent = components.find(c => c.id === currentParentId);
      if (!parent) break;
      if (parent.visible === false) return true;
      currentParentId = parent.parentId;
    }
    return false;
  }, []);

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
    return Math.abs(value - snappedValue) <= snapThreshold;
  }, [snapThreshold]);

  // Smart snapping function that returns snapped position and active guides
  const smartSnap = useCallback((
    rawX: number,
    rawY: number,
    componentWidth: number,
    componentHeight: number,
    enableSnapping: boolean,
    excludeComponentIds?: string[] // IDs of components to exclude from element-to-element checks (all selected components)
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

    // If Alt is held, skip all smart snapping but still apply grid
    // Use ref for immediate access during drag (state may be stale during rapid events)
    if (isAltHeldRef.current) {
      if (showGrid) {
        snappedX = snapToGrid(snappedX, 'width');
        snappedY = snapToGrid(snappedY, 'height');
      }
      return {
        x: snappedX,
        y: snappedY,
        guides: { guides: [], elementBounds: undefined }
      };
    }

    if (enableSnapping) {
      // Track if we've snapped on each axis to prevent conflicting snaps
      let snappedOnX = false;
      let snappedOnY = false;

      // Get other components for element-to-element snapping (exclude all selected components)
      const excludeSet = new Set(excludeComponentIds || []);
      const otherComponents = (layout.components || []).filter(
        c => !excludeSet.has(c.id) && c.visible !== false
      );

      // ========== CANVAS CENTER SNAPPING (highest priority) ==========
      if (snapToCanvasGuides) {
        // 1. Check element CENTER to canvas center
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

        // 2. Check element edges to canvas center
        if (!snappedOnX && Math.abs(elementLeft - canvasCenterX) <= snapThreshold) {
          snappedX = canvasCenterX;
          guides.push({ type: 'center-v', position: canvasCenterX });
          snappedOnX = true;
        }

        if (!snappedOnX && Math.abs(elementRight - canvasCenterX) <= snapThreshold) {
          snappedX = canvasCenterX - componentWidth;
          guides.push({ type: 'center-v', position: canvasCenterX });
          snappedOnX = true;
        }

        if (!snappedOnY && Math.abs(elementTop - canvasCenterY) <= snapThreshold) {
          snappedY = canvasCenterY;
          guides.push({ type: 'center-h', position: canvasCenterY });
          snappedOnY = true;
        }

        if (!snappedOnY && Math.abs(elementBottom - canvasCenterY) <= snapThreshold) {
          snappedY = canvasCenterY - componentHeight;
          guides.push({ type: 'center-h', position: canvasCenterY });
          snappedOnY = true;
        }
      }

      // ========== ELEMENT-TO-ELEMENT SNAPPING ==========
      if (snapToElements) {
        for (const other of otherComponents) {
        const otherLeft = other.position.x;
        const otherRight = other.position.x + other.size.width;
        const otherTop = other.position.y;
        const otherBottom = other.position.y + other.size.height;
        const otherCenterX = other.position.x + other.size.width / 2;
        const otherCenterY = other.position.y + other.size.height / 2;

        // Calculate vertical span for horizontal guides (min/max Y of both elements)
        const getVerticalSpan = () => ({
          start: Math.min(elementTop, otherTop),
          end: Math.max(elementBottom, otherBottom)
        });

        // Calculate horizontal span for vertical guides (min/max X of both elements)
        const getHorizontalSpan = () => ({
          start: Math.min(elementLeft, otherLeft),
          end: Math.max(elementRight, otherRight)
        });

        // --- Vertical edge alignments (X-axis snapping) ---

        // Left edge to left edge
        if (!snappedOnX && Math.abs(elementLeft - otherLeft) <= snapThreshold) {
          snappedX = otherLeft;
          guides.push({ type: 'element-edge-v', position: otherLeft, span: getVerticalSpan() });
          snappedOnX = true;
        }

        // Right edge to right edge
        if (!snappedOnX && Math.abs(elementRight - otherRight) <= snapThreshold) {
          snappedX = otherRight - componentWidth;
          guides.push({ type: 'element-edge-v', position: otherRight, span: getVerticalSpan() });
          snappedOnX = true;
        }

        // Left edge to right edge
        if (!snappedOnX && Math.abs(elementLeft - otherRight) <= snapThreshold) {
          snappedX = otherRight;
          guides.push({ type: 'element-edge-v', position: otherRight, span: getVerticalSpan() });
          snappedOnX = true;
        }

        // Right edge to left edge
        if (!snappedOnX && Math.abs(elementRight - otherLeft) <= snapThreshold) {
          snappedX = otherLeft - componentWidth;
          guides.push({ type: 'element-edge-v', position: otherLeft, span: getVerticalSpan() });
          snappedOnX = true;
        }

        // Center to center (horizontal alignment)
        if (!snappedOnX && Math.abs(elementCenterX - otherCenterX) <= snapThreshold) {
          snappedX = otherCenterX - componentWidth / 2;
          guides.push({ type: 'element-center-v', position: otherCenterX, span: getVerticalSpan() });
          snappedOnX = true;
        }

        // --- Horizontal edge alignments (Y-axis snapping) ---

        // Top edge to top edge
        if (!snappedOnY && Math.abs(elementTop - otherTop) <= snapThreshold) {
          snappedY = otherTop;
          guides.push({ type: 'element-edge-h', position: otherTop, span: getHorizontalSpan() });
          snappedOnY = true;
        }

        // Bottom edge to bottom edge
        if (!snappedOnY && Math.abs(elementBottom - otherBottom) <= snapThreshold) {
          snappedY = otherBottom - componentHeight;
          guides.push({ type: 'element-edge-h', position: otherBottom, span: getHorizontalSpan() });
          snappedOnY = true;
        }

        // Top edge to bottom edge
        if (!snappedOnY && Math.abs(elementTop - otherBottom) <= snapThreshold) {
          snappedY = otherBottom;
          guides.push({ type: 'element-edge-h', position: otherBottom, span: getHorizontalSpan() });
          snappedOnY = true;
        }

        // Bottom edge to top edge
        if (!snappedOnY && Math.abs(elementBottom - otherTop) <= snapThreshold) {
          snappedY = otherTop - componentHeight;
          guides.push({ type: 'element-edge-h', position: otherTop, span: getHorizontalSpan() });
          snappedOnY = true;
        }

        // Center to center (vertical alignment)
        if (!snappedOnY && Math.abs(elementCenterY - otherCenterY) <= snapThreshold) {
          snappedY = otherCenterY - componentHeight / 2;
          guides.push({ type: 'element-center-h', position: otherCenterY, span: getHorizontalSpan() });
          snappedOnY = true;
        }

          // Break early if we've snapped on both axes
          if (snappedOnX && snappedOnY) break;
        }
      }

      // ========== CANVAS EDGE SNAPPING ==========
      if (snapToCanvasGuides) {
        // Check left edge to canvas left
        if (!snappedOnX && Math.abs(elementLeft) <= snapThreshold) {
          snappedX = 0;
          guides.push({ type: 'edge-left', position: 0 });
          snappedOnX = true;
        }

        // Check right edge to canvas right
        if (!snappedOnX && Math.abs(elementRight - canvasWidth) <= snapThreshold) {
          snappedX = canvasWidth - componentWidth;
          guides.push({ type: 'edge-right', position: canvasWidth });
          snappedOnX = true;
        }

        // Check top edge to canvas top
        if (!snappedOnY && Math.abs(elementTop) <= snapThreshold) {
          snappedY = 0;
          guides.push({ type: 'edge-top', position: 0 });
          snappedOnY = true;
        }

        // Check bottom edge to canvas bottom
        if (!snappedOnY && Math.abs(elementBottom - canvasHeight) <= snapThreshold) {
          snappedY = canvasHeight - componentHeight;
          guides.push({ type: 'edge-bottom', position: canvasHeight });
          snappedOnY = true;
        }
      }

      // Apply grid snapping on axes that aren't already snapped by smart guides
      // This ensures movement is always grid-locked when grid is enabled
      if (showGrid) {
        if (!snappedOnX) {
          snappedX = snapToGrid(snappedX, 'width');
        }
        if (!snappedOnY) {
          snappedY = snapToGrid(snappedY, 'height');
        }
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
  }, [layout.dimensions.width, layout.dimensions.height, layout.components, snapToGrid, showGrid, snapThreshold, snapToElements, snapToCanvasGuides]);

  // Smart snapping function for resize operations - snaps moving edges to guides
  const smartSnapResize = useCallback((
    handle: string,
    left: number,
    top: number,
    right: number,
    bottom: number,
    excludeComponentIds?: string[]
  ): { left: number; top: number; right: number; bottom: number; guides: ActiveGuides } => {
    const guides: SmartGuide[] = [];
    let snappedLeft = left;
    let snappedTop = top;
    let snappedRight = right;
    let snappedBottom = bottom;

    const canvasWidth = layout.dimensions.width;
    const canvasHeight = layout.dimensions.height;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    // Determine which edges are being moved based on handle
    const movingLeft = handle === 'nw' || handle === 'sw';
    const movingRight = handle === 'ne' || handle === 'se';
    const movingTop = handle === 'nw' || handle === 'ne';
    const movingBottom = handle === 'sw' || handle === 'se';

    // If Alt is held, skip all smart snapping but still apply grid
    if (isAltHeldRef.current) {
      if (showGrid) {
        if (movingLeft) snappedLeft = snapToGrid(snappedLeft, 'width');
        if (movingRight) snappedRight = snapToGrid(snappedRight, 'width');
        if (movingTop) snappedTop = snapToGrid(snappedTop, 'height');
        if (movingBottom) snappedBottom = snapToGrid(snappedBottom, 'height');
      }
      return {
        left: snappedLeft,
        top: snappedTop,
        right: snappedRight,
        bottom: snappedBottom,
        guides: { guides: [] }
      };
    }

    // Track if we've snapped each edge
    let snappedLeftEdge = false;
    let snappedRightEdge = false;
    let snappedTopEdge = false;
    let snappedBottomEdge = false;

    // Get other components for element-to-element snapping
    const excludeSet = new Set(excludeComponentIds || []);
    const otherComponents = (layout.components || []).filter(
      c => !excludeSet.has(c.id) && c.visible !== false
    );

    // Helper to get vertical span for horizontal guides
    const getVerticalSpan = (otherTop: number, otherBottom: number) => ({
      start: Math.min(top, otherTop),
      end: Math.max(bottom, otherBottom)
    });

    // Helper to get horizontal span for vertical guides
    const getHorizontalSpan = (otherLeft: number, otherRight: number) => ({
      start: Math.min(left, otherLeft),
      end: Math.max(right, otherRight)
    });

    // ========== CANVAS CENTER SNAPPING ==========
    if (snapToCanvasGuides) {
      // Snap moving edges to canvas center
      if (movingLeft && !snappedLeftEdge && Math.abs(left - canvasCenterX) <= snapThreshold) {
        snappedLeft = canvasCenterX;
        guides.push({ type: 'center-v', position: canvasCenterX });
        snappedLeftEdge = true;
      }
      if (movingRight && !snappedRightEdge && Math.abs(right - canvasCenterX) <= snapThreshold) {
        snappedRight = canvasCenterX;
        guides.push({ type: 'center-v', position: canvasCenterX });
        snappedRightEdge = true;
      }
      if (movingTop && !snappedTopEdge && Math.abs(top - canvasCenterY) <= snapThreshold) {
        snappedTop = canvasCenterY;
        guides.push({ type: 'center-h', position: canvasCenterY });
        snappedTopEdge = true;
      }
      if (movingBottom && !snappedBottomEdge && Math.abs(bottom - canvasCenterY) <= snapThreshold) {
        snappedBottom = canvasCenterY;
        guides.push({ type: 'center-h', position: canvasCenterY });
        snappedBottomEdge = true;
      }
    }

    // ========== ELEMENT-TO-ELEMENT SNAPPING ==========
    if (snapToElements) {
      for (const other of otherComponents) {
        const otherLeft = other.position.x;
        const otherRight = other.position.x + other.size.width;
        const otherTop = other.position.y;
        const otherBottom = other.position.y + other.size.height;
        const otherCenterX = other.position.x + other.size.width / 2;
        const otherCenterY = other.position.y + other.size.height / 2;

        // --- Vertical edge snapping (X-axis) ---
        if (movingLeft && !snappedLeftEdge) {
          // Left edge to other left edge
          if (Math.abs(left - otherLeft) <= snapThreshold) {
            snappedLeft = otherLeft;
            guides.push({ type: 'element-edge-v', position: otherLeft, span: getVerticalSpan(otherTop, otherBottom) });
            snappedLeftEdge = true;
          }
          // Left edge to other right edge
          else if (Math.abs(left - otherRight) <= snapThreshold) {
            snappedLeft = otherRight;
            guides.push({ type: 'element-edge-v', position: otherRight, span: getVerticalSpan(otherTop, otherBottom) });
            snappedLeftEdge = true;
          }
          // Left edge to other center
          else if (Math.abs(left - otherCenterX) <= snapThreshold) {
            snappedLeft = otherCenterX;
            guides.push({ type: 'element-center-v', position: otherCenterX, span: getVerticalSpan(otherTop, otherBottom) });
            snappedLeftEdge = true;
          }
        }

        if (movingRight && !snappedRightEdge) {
          // Right edge to other right edge
          if (Math.abs(right - otherRight) <= snapThreshold) {
            snappedRight = otherRight;
            guides.push({ type: 'element-edge-v', position: otherRight, span: getVerticalSpan(otherTop, otherBottom) });
            snappedRightEdge = true;
          }
          // Right edge to other left edge
          else if (Math.abs(right - otherLeft) <= snapThreshold) {
            snappedRight = otherLeft;
            guides.push({ type: 'element-edge-v', position: otherLeft, span: getVerticalSpan(otherTop, otherBottom) });
            snappedRightEdge = true;
          }
          // Right edge to other center
          else if (Math.abs(right - otherCenterX) <= snapThreshold) {
            snappedRight = otherCenterX;
            guides.push({ type: 'element-center-v', position: otherCenterX, span: getVerticalSpan(otherTop, otherBottom) });
            snappedRightEdge = true;
          }
        }

        // --- Horizontal edge snapping (Y-axis) ---
        if (movingTop && !snappedTopEdge) {
          // Top edge to other top edge
          if (Math.abs(top - otherTop) <= snapThreshold) {
            snappedTop = otherTop;
            guides.push({ type: 'element-edge-h', position: otherTop, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedTopEdge = true;
          }
          // Top edge to other bottom edge
          else if (Math.abs(top - otherBottom) <= snapThreshold) {
            snappedTop = otherBottom;
            guides.push({ type: 'element-edge-h', position: otherBottom, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedTopEdge = true;
          }
          // Top edge to other center
          else if (Math.abs(top - otherCenterY) <= snapThreshold) {
            snappedTop = otherCenterY;
            guides.push({ type: 'element-center-h', position: otherCenterY, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedTopEdge = true;
          }
        }

        if (movingBottom && !snappedBottomEdge) {
          // Bottom edge to other bottom edge
          if (Math.abs(bottom - otherBottom) <= snapThreshold) {
            snappedBottom = otherBottom;
            guides.push({ type: 'element-edge-h', position: otherBottom, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedBottomEdge = true;
          }
          // Bottom edge to other top edge
          else if (Math.abs(bottom - otherTop) <= snapThreshold) {
            snappedBottom = otherTop;
            guides.push({ type: 'element-edge-h', position: otherTop, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedBottomEdge = true;
          }
          // Bottom edge to other center
          else if (Math.abs(bottom - otherCenterY) <= snapThreshold) {
            snappedBottom = otherCenterY;
            guides.push({ type: 'element-center-h', position: otherCenterY, span: getHorizontalSpan(otherLeft, otherRight) });
            snappedBottomEdge = true;
          }
        }

        // Break if all moving edges are snapped
        const allSnapped =
          (!movingLeft || snappedLeftEdge) &&
          (!movingRight || snappedRightEdge) &&
          (!movingTop || snappedTopEdge) &&
          (!movingBottom || snappedBottomEdge);
        if (allSnapped) break;
      }
    }

    // ========== CANVAS EDGE SNAPPING ==========
    if (snapToCanvasGuides) {
      if (movingLeft && !snappedLeftEdge && Math.abs(left) <= snapThreshold) {
        snappedLeft = 0;
        guides.push({ type: 'edge-left', position: 0 });
        snappedLeftEdge = true;
      }
      if (movingRight && !snappedRightEdge && Math.abs(right - canvasWidth) <= snapThreshold) {
        snappedRight = canvasWidth;
        guides.push({ type: 'edge-right', position: canvasWidth });
        snappedRightEdge = true;
      }
      if (movingTop && !snappedTopEdge && Math.abs(top) <= snapThreshold) {
        snappedTop = 0;
        guides.push({ type: 'edge-top', position: 0 });
        snappedTopEdge = true;
      }
      if (movingBottom && !snappedBottomEdge && Math.abs(bottom - canvasHeight) <= snapThreshold) {
        snappedBottom = canvasHeight;
        guides.push({ type: 'edge-bottom', position: canvasHeight });
        snappedBottomEdge = true;
      }
    }

    // ========== GRID SNAPPING (fallback) ==========
    if (showGrid) {
      if (movingLeft && !snappedLeftEdge) snappedLeft = snapToGrid(snappedLeft, 'width');
      if (movingRight && !snappedRightEdge) snappedRight = snapToGrid(snappedRight, 'width');
      if (movingTop && !snappedTopEdge) snappedTop = snapToGrid(snappedTop, 'height');
      if (movingBottom && !snappedBottomEdge) snappedBottom = snapToGrid(snappedBottom, 'height');
    }

    // Calculate final bounds for guide rendering
    const finalWidth = snappedRight - snappedLeft;
    const finalHeight = snappedBottom - snappedTop;

    return {
      left: snappedLeft,
      top: snappedTop,
      right: snappedRight,
      bottom: snappedBottom,
      guides: {
        guides,
        elementBounds: {
          left: snappedLeft,
          top: snappedTop,
          right: snappedRight,
          bottom: snappedBottom,
          centerX: snappedLeft + finalWidth / 2,
          centerY: snappedTop + finalHeight / 2
        }
      }
    };
  }, [layout.dimensions.width, layout.dimensions.height, layout.components, snapToGrid, showGrid, snapThreshold, snapToElements, snapToCanvasGuides]);

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

          // Store initial positions of all selected components AND their descendants
          const positions = new Map<string, { x: number, y: number }>();
          const selectedIds = selectedComponentsRef.current;
          const descendantIds = getAllDescendants(selectedIds, layoutRef.current.components);
          const allIdsToMove = [...selectedIds, ...descendantIds];

          allIdsToMove.forEach(componentId => {
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

          // Store initial position of the single selected component AND its descendants
          const positions = new Map<string, { x: number, y: number }>();
          const descendantIds = getAllDescendants([draggedComponent.id], layoutRef.current.components);
          const allIdsToMove = [draggedComponent.id, ...descendantIds];

          allIdsToMove.forEach(componentId => {
            const component = layoutRef.current.components.find(c => c.id === componentId);
            if (component) {
              positions.set(componentId, { x: component.position.x, y: component.position.y });
            }
          });
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
      const rawPrimaryX = canvasX - dragOffset.x;
      const rawPrimaryY = canvasY - dragOffset.y;

      // Get the initial position of the primary component
      const initialPrimaryPos = initialComponentPositions.get(draggedComponent.id) || draggedComponent.position;

      // Calculate the raw delta from initial position
      const rawDeltaX = rawPrimaryX - initialPrimaryPos.x;
      const rawDeltaY = rawPrimaryY - initialPrimaryPos.y;

      // For multi-selection, calculate the bounding box of the selection and use it for snapping
      const selectedIds = selectedComponentsRef.current;
      let snapWidth: number;
      let snapHeight: number;
      let snapRawX: number;
      let snapRawY: number;

      if (selectedIds.length > 1) {
        // Calculate initial bounding box of all selected components
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        selectedIds.forEach(id => {
          const initPos = initialComponentPositions.get(id);
          const comp = layoutRef.current.components.find(c => c.id === id);
          if (initPos && comp) {
            minX = Math.min(minX, initPos.x);
            minY = Math.min(minY, initPos.y);
            maxX = Math.max(maxX, initPos.x + comp.size.width);
            maxY = Math.max(maxY, initPos.y + comp.size.height);
          }
        });

        // Bounding box dimensions
        snapWidth = maxX - minX;
        snapHeight = maxY - minY;

        // Calculate where the bounding box would be with the current drag delta
        snapRawX = minX + rawDeltaX;
        snapRawY = minY + rawDeltaY;
      } else {
        // Single selection - use the component's own dimensions
        snapWidth = draggedComponent.size.width;
        snapHeight = draggedComponent.size.height;
        snapRawX = rawPrimaryX;
        snapRawY = rawPrimaryY;
      }

      // Only snap size to grid if grid is enabled (for single selection)
      if (showGrid && selectedIds.length === 1) {
        snapWidth = snapToGrid(snapWidth, 'width');
        snapHeight = snapToGrid(snapHeight, 'height');
      }

      // Use smart snapping with the bounding box dimensions
      // Pass all selected component IDs to exclude them from element-to-element snapping
      const snapResult = smartSnap(snapRawX, snapRawY, snapWidth, snapHeight, true, selectedIds);

      // Update active guides for visual feedback
      setActiveGuides(snapResult.guides);

      // Calculate the snapped delta
      const snappedDeltaX = (snapResult.x - snapRawX) + rawDeltaX;
      const snappedDeltaY = (snapResult.y - snapRawY) + rawDeltaY;

      // Update all selected components AND their descendants
      initialComponentPositions.forEach((initialPos, componentId) => {
        const newX = initialPos.x + snappedDeltaX;
        const newY = initialPos.y + snappedDeltaY;

        // For single selection of primary component, also update size if grid snapping
        if (selectedIds.length === 1 && componentId === draggedComponent.id) {
          onUpdateComponent(componentId, {
            position: { x: newX, y: newY },
            size: { width: snapWidth, height: snapHeight }
          });
        } else {
          onUpdateComponent(componentId, {
            position: { x: newX, y: newY }
          });
        }
      });
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

  // ========== ALIGNMENT FUNCTIONS ==========

  // Get selected components data
  const getSelectedComponentsData = useCallback(() => {
    return selectedComponents
      .map(id => layout.components.find(c => c.id === id))
      .filter((c): c is ComponentConfig => c !== undefined);
  }, [selectedComponents, layout.components]);

  // Align selected components to left
  const alignLeft = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const minX = Math.min(...components.map(c => c.position.x));
    components.forEach(comp => {
      onUpdateComponent(comp.id, { position: { ...comp.position, x: minX } });
    });
    onEndDragOperation('Align left');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Align selected components to horizontal center
  const alignCenterH = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const minX = Math.min(...components.map(c => c.position.x));
    const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
    const centerX = (minX + maxX) / 2;

    components.forEach(comp => {
      const newX = centerX - comp.size.width / 2;
      onUpdateComponent(comp.id, { position: { ...comp.position, x: newX } });
    });
    onEndDragOperation('Align center horizontal');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Align selected components to right
  const alignRight = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
    components.forEach(comp => {
      onUpdateComponent(comp.id, { position: { ...comp.position, x: maxX - comp.size.width } });
    });
    onEndDragOperation('Align right');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Align selected components to top
  const alignTop = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const minY = Math.min(...components.map(c => c.position.y));
    components.forEach(comp => {
      onUpdateComponent(comp.id, { position: { ...comp.position, y: minY } });
    });
    onEndDragOperation('Align top');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Align selected components to vertical center
  const alignCenterV = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const minY = Math.min(...components.map(c => c.position.y));
    const maxY = Math.max(...components.map(c => c.position.y + c.size.height));
    const centerY = (minY + maxY) / 2;

    components.forEach(comp => {
      const newY = centerY - comp.size.height / 2;
      onUpdateComponent(comp.id, { position: { ...comp.position, y: newY } });
    });
    onEndDragOperation('Align center vertical');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Align selected components to bottom
  const alignBottom = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 2) return;

    onStartDragOperation();
    const maxY = Math.max(...components.map(c => c.position.y + c.size.height));
    components.forEach(comp => {
      onUpdateComponent(comp.id, { position: { ...comp.position, y: maxY - comp.size.height } });
    });
    onEndDragOperation('Align bottom');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Distribute selected components horizontally (equal spacing)
  const distributeH = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 3) return;

    onStartDragOperation();
    // Sort by x position
    const sorted = [...components].sort((a, b) => a.position.x - b.position.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate total width of all components
    const totalComponentWidth = sorted.reduce((sum, c) => sum + c.size.width, 0);
    // Calculate available space
    const totalSpace = (last.position.x + last.size.width) - first.position.x;
    // Calculate gap between components
    const gap = (totalSpace - totalComponentWidth) / (sorted.length - 1);

    let currentX = first.position.x;
    sorted.forEach((comp, index) => {
      if (index === 0) {
        currentX += comp.size.width + gap;
        return;
      }
      onUpdateComponent(comp.id, { position: { ...comp.position, x: currentX } });
      currentX += comp.size.width + gap;
    });
    onEndDragOperation('Distribute horizontal');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Distribute selected components vertically (equal spacing)
  const distributeV = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length < 3) return;

    onStartDragOperation();
    // Sort by y position
    const sorted = [...components].sort((a, b) => a.position.y - b.position.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate total height of all components
    const totalComponentHeight = sorted.reduce((sum, c) => sum + c.size.height, 0);
    // Calculate available space
    const totalSpace = (last.position.y + last.size.height) - first.position.y;
    // Calculate gap between components
    const gap = (totalSpace - totalComponentHeight) / (sorted.length - 1);

    let currentY = first.position.y;
    sorted.forEach((comp, index) => {
      if (index === 0) {
        currentY += comp.size.height + gap;
        return;
      }
      onUpdateComponent(comp.id, { position: { ...comp.position, y: currentY } });
      currentY += comp.size.height + gap;
    });
    onEndDragOperation('Distribute vertical');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Center selected component(s) on canvas horizontally
  const centerOnCanvasH = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length === 0) return;

    onStartDragOperation();
    const canvasCenterX = layout.dimensions.width / 2;

    if (components.length === 1) {
      // Single component - center it
      const comp = components[0];
      const newX = canvasCenterX - comp.size.width / 2;
      onUpdateComponent(comp.id, { position: { ...comp.position, x: newX } });
    } else {
      // Multiple components - center the group
      const minX = Math.min(...components.map(c => c.position.x));
      const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
      const groupWidth = maxX - minX;
      const groupCenterX = minX + groupWidth / 2;
      const offset = canvasCenterX - groupCenterX;

      components.forEach(comp => {
        onUpdateComponent(comp.id, { position: { ...comp.position, x: comp.position.x + offset } });
      });
    }
    onEndDragOperation('Center on canvas horizontal');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation, layout.dimensions.width]);

  // Center selected component(s) on canvas vertically
  const centerOnCanvasV = useCallback(() => {
    const components = getSelectedComponentsData();
    if (components.length === 0) return;

    onStartDragOperation();
    const canvasCenterY = layout.dimensions.height / 2;

    if (components.length === 1) {
      // Single component - center it
      const comp = components[0];
      const newY = canvasCenterY - comp.size.height / 2;
      onUpdateComponent(comp.id, { position: { ...comp.position, y: newY } });
    } else {
      // Multiple components - center the group
      const minY = Math.min(...components.map(c => c.position.y));
      const maxY = Math.max(...components.map(c => c.position.y + c.size.height));
      const groupHeight = maxY - minY;
      const groupCenterY = minY + groupHeight / 2;
      const offset = canvasCenterY - groupCenterY;

      components.forEach(comp => {
        onUpdateComponent(comp.id, { position: { ...comp.position, y: comp.position.y + offset } });
      });
    }
    onEndDragOperation('Center on canvas vertical');
  }, [getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation, layout.dimensions.height]);

  // Set parent-child relationship: first selected becomes parent, rest become children
  const setAsParent = useCallback(() => {
    if (selectedComponents.length < 2) return;

    onStartDragOperation();
    const parentId = selectedComponents[0];
    const childIds = selectedComponents.slice(1);

    childIds.forEach(childId => {
      onUpdateComponent(childId, { parentId });
    });
    onEndDragOperation('Set parent-child relationship');
  }, [selectedComponents, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

  // Clear parent relationship from selected components
  const clearParent = useCallback(() => {
    if (selectedComponents.length === 0) return;

    const components = getSelectedComponentsData();
    const hasParent = components.some(c => c.parentId);
    if (!hasParent) return;

    onStartDragOperation();
    components.forEach(comp => {
      if (comp.parentId) {
        onUpdateComponent(comp.id, { parentId: undefined });
      }
    });
    onEndDragOperation('Clear parent relationship');
  }, [selectedComponents, getSelectedComponentsData, onUpdateComponent, onStartDragOperation, onEndDragOperation]);

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

    // Single component resize logic
    const currentLeft = draggedComponent.position.x;
    const currentTop = draggedComponent.position.y;
    const currentWidth = draggedComponent.size.width;
    const currentHeight = draggedComponent.size.height;
    const currentRight = currentLeft + currentWidth;
    const currentBottom = currentTop + currentHeight;

    // Calculate original aspect ratio
    const aspectRatio = currentWidth / currentHeight;

    const minSize = 20;

    // Calculate raw edge positions based on resize handle
    let rawLeft = currentLeft;
    let rawTop = currentTop;
    let rawRight = currentRight;
    let rawBottom = currentBottom;

    switch (resizeHandle) {
      case 'se': // Bottom-right - right and bottom edges move
        rawRight = canvasX;
        rawBottom = canvasY;
        if (maintainAspectRatio) {
          const newWidth = Math.max(minSize, rawRight - rawLeft);
          rawBottom = rawTop + newWidth / aspectRatio;
        }
        break;
      case 'sw': // Bottom-left - left and bottom edges move
        rawLeft = canvasX;
        rawBottom = canvasY;
        if (maintainAspectRatio) {
          const newWidth = Math.max(minSize, rawRight - rawLeft);
          rawBottom = rawTop + newWidth / aspectRatio;
        }
        break;
      case 'ne': // Top-right - right and top edges move
        rawRight = canvasX;
        rawTop = canvasY;
        if (maintainAspectRatio) {
          const newWidth = Math.max(minSize, rawRight - rawLeft);
          rawTop = rawBottom - newWidth / aspectRatio;
        }
        break;
      case 'nw': // Top-left - left and top edges move
        rawLeft = canvasX;
        rawTop = canvasY;
        if (maintainAspectRatio) {
          const newWidth = Math.max(minSize, rawRight - rawLeft);
          rawTop = rawBottom - newWidth / aspectRatio;
        }
        break;
    }

    // Apply smart snapping to the edges being resized
    const snapResult = smartSnapResize(
      resizeHandle,
      rawLeft,
      rawTop,
      rawRight,
      rawBottom,
      [draggedComponent.id] // Exclude the component being resized
    );

    // Update active guides for visual feedback
    setActiveGuides(snapResult.guides);

    // Calculate final dimensions from snapped edges
    let finalLeft = snapResult.left;
    let finalTop = snapResult.top;
    let finalRight = snapResult.right;
    let finalBottom = snapResult.bottom;

    // Enforce minimum size
    if (finalRight - finalLeft < minSize) {
      if (resizeHandle === 'nw' || resizeHandle === 'sw') {
        finalLeft = finalRight - minSize;
      } else {
        finalRight = finalLeft + minSize;
      }
    }
    if (finalBottom - finalTop < minSize) {
      if (resizeHandle === 'nw' || resizeHandle === 'ne') {
        finalTop = finalBottom - minSize;
      } else {
        finalBottom = finalTop + minSize;
      }
    }

    const newX = finalLeft;
    const newY = finalTop;
    const newWidth = finalRight - finalLeft;
    const newHeight = finalBottom - finalTop;

    // Store pixel values directly
    onUpdateComponent(draggedComponent.id, {
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight }
    });
  }, [draggedComponent, resizeHandle, snapToGrid, onUpdateComponent, showGrid, selectedComponents, getMultiSelectBounds, smartSnapResize]);

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
      .filter(component =>
        component.visible !== false &&
        component.type !== 'group' &&
        !isAncestorHidden(component, layout.components || [])
      ) // Only check visible, non-group components with visible ancestors
      .find(component => {
        // Positions and sizes are already in pixels
        const left = component.position.x;
        const top = component.position.y;
        const width = component.size.width;
        const height = component.size.height;

        return x >= left && x <= left + width && y >= top && y <= top + height;
      });
  }, [layout.components, isAncestorHidden]);

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

  // Alt key listener to temporarily disable snapping
  React.useEffect(() => {
    const handleAltKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = true;
        setIsAltHeld(true);
      }
    };
    const handleAltKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = false;
        setIsAltHeld(false);
      }
    };
    document.addEventListener('keydown', handleAltKeyDown);
    document.addEventListener('keyup', handleAltKeyUp);
    // Also clear Alt state when window loses focus
    const handleBlur = () => {
      isAltHeldRef.current = false;
      setIsAltHeld(false);
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('keydown', handleAltKeyDown);
      document.removeEventListener('keyup', handleAltKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Auto-fit canvas to available space
  const fitCanvasToWrapper = useCallback(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const padding = 40; // 20px padding on each side
    const availableWidth = wrapper.clientWidth - padding;
    const availableHeight = wrapper.clientHeight - padding;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / layout.dimensions.width;
    const scaleY = availableHeight / layout.dimensions.height;
    const fitScale = Math.min(scaleX, scaleY, 2.0); // Cap at 200%

    setZoomLevel(Math.max(10, Math.round(fitScale * 100)));
    setViewportOffset({ x: 0, y: 0 });
  }, [layout.dimensions.width, layout.dimensions.height]);

  // Calculate effective z-index based on hierarchy (parent layers affect children)
  const getEffectiveLayer = (component: ComponentConfig): number => {
    let effectiveLayer = component.layer || 0;
    let parentId = component.parentId;
    let multiplier = 1000; // Each parent level adds this much priority

    while (parentId) {
      const parent = (layout.components || []).find(c => c.id === parentId);
      if (!parent) break;
      // Add parent's layer contribution - higher parent layer = higher z-index for all children
      effectiveLayer += (parent.layer || 0) * multiplier;
      parentId = parent.parentId;
      multiplier *= 1000; // Increase multiplier for deeper nesting
    }

    return effectiveLayer;
  };

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
    const hasParent = !!component.parentId;
    const hasChildren = layout.components.some(c => c.parentId === component.id);

    return (
      <div
        key={component.id}
        style={{
          ...baseStyle,
          backgroundColor: 'transparent',
          pointerEvents: 'auto', // Always capture events for component interaction
          zIndex: getEffectiveLayer(component) + (isSelected ? 10000000 : 0), // Respect hierarchy layer order, selected on top
        }}
        onMouseDown={(e) => handleMouseDown(e, component)}
        className="canvas-handle"
      >
        {/* Parent-child relationship indicators */}
        {hasParent && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: -8,
              width: 16,
              height: 16,
              backgroundColor: '#ff9800',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
            title="This component is a child"
          >
            ⛓
          </div>
        )}
        {hasChildren && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 16,
              height: 16,
              backgroundColor: '#2196f3',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
            title="This component has children"
          >
            P
          </div>
        )}
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
          {/* Snap Type Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '12px' }}>
            <button
              className="grid-button"
              onClick={() => setSnapToElements(!snapToElements)}
              title={snapToElements ? "Disable element-to-element snapping" : "Enable element-to-element snapping"}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: snapToElements ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255,255,255,0.1)',
                border: snapToElements ? '1px solid rgba(0, 255, 0, 0.5)' : '1px solid rgba(255,255,255,0.2)'
              }}
            >
              Elements
            </button>
            <button
              className="grid-button"
              onClick={() => setSnapToCanvasGuides(!snapToCanvasGuides)}
              title={snapToCanvasGuides ? "Disable canvas center/edge snapping" : "Enable canvas center/edge snapping"}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: snapToCanvasGuides ? 'rgba(255, 0, 255, 0.3)' : 'rgba(255,255,255,0.1)',
                border: snapToCanvasGuides ? '1px solid rgba(255, 0, 255, 0.5)' : '1px solid rgba(255,255,255,0.2)'
              }}
            >
              Canvas
            </button>
            {isAltHeld && (
              <span style={{
                fontSize: '10px',
                color: '#ff9800',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 152, 0, 0.5)'
              }}>
                Alt: Grid Only
              </span>
            )}
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
        {/* Alignment Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: '12px',
          borderLeft: '1px solid rgba(255,255,255,0.2)',
          paddingLeft: '12px'
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginRight: '4px' }}>Align:</span>
          {/* Horizontal alignments */}
          <button
            className="grid-button"
            onClick={alignLeft}
            disabled={selectedComponents.length < 2}
            title="Align left edges (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ⬅
          </button>
          <button
            className="grid-button"
            onClick={alignCenterH}
            disabled={selectedComponents.length < 2}
            title="Align horizontal centers (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ⬌
          </button>
          <button
            className="grid-button"
            onClick={alignRight}
            disabled={selectedComponents.length < 2}
            title="Align right edges (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ➡
          </button>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          {/* Vertical alignments */}
          <button
            className="grid-button"
            onClick={alignTop}
            disabled={selectedComponents.length < 2}
            title="Align top edges (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ⬆
          </button>
          <button
            className="grid-button"
            onClick={alignCenterV}
            disabled={selectedComponents.length < 2}
            title="Align vertical centers (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ⬍
          </button>
          <button
            className="grid-button"
            onClick={alignBottom}
            disabled={selectedComponents.length < 2}
            title="Align bottom edges (2+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 2 ? 0.5 : 1 }}
          >
            ⬇
          </button>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          {/* Distribute */}
          <button
            className="grid-button"
            onClick={distributeH}
            disabled={selectedComponents.length < 3}
            title="Distribute horizontally (3+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 3 ? 0.5 : 1 }}
          >
            ⫴
          </button>
          <button
            className="grid-button"
            onClick={distributeV}
            disabled={selectedComponents.length < 3}
            title="Distribute vertically (3+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 3 ? 0.5 : 1 }}
          >
            ⫳
          </button>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          {/* Center on canvas */}
          <button
            className="grid-button"
            onClick={centerOnCanvasH}
            disabled={selectedComponents.length < 1}
            title="Center on canvas horizontally (1+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 1 ? 0.5 : 1 }}
          >
            ⧫H
          </button>
          <button
            className="grid-button"
            onClick={centerOnCanvasV}
            disabled={selectedComponents.length < 1}
            title="Center on canvas vertically (1+ selected)"
            style={{ padding: '4px 6px', fontSize: '12px', opacity: selectedComponents.length < 1 ? 0.5 : 1 }}
          >
            ⧫V
          </button>
        </div>
      </div>
      
      <div
        ref={wrapperRef}
        className="canvas-wrapper"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
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
                const colors: Record<string, string> = {
                  'center-h': '#FF00FF', // Magenta for canvas center
                  'center-v': '#FF00FF',
                  'edge-top': '#00FFFF', // Cyan for canvas edges
                  'edge-bottom': '#00FFFF',
                  'edge-left': '#00FFFF',
                  'edge-right': '#00FFFF',
                  'element-edge-h': '#00FF00', // Green for element-to-element edges
                  'element-edge-v': '#00FF00',
                  'element-center-h': '#39FF14', // Bright green for element-to-element centers
                  'element-center-v': '#39FF14'
                };
                const color = colors[guide.type] || '#FF00FF';
                const isElementGuide = guide.type.startsWith('element-');
                const isCenterGuide = guide.type.includes('center');

                // Determine if this is a vertical or horizontal guide
                const isVertical = guide.type === 'center-v' || guide.type === 'edge-left' || guide.type === 'edge-right' ||
                                   guide.type === 'element-edge-v' || guide.type === 'element-center-v';

                if (isVertical) {
                  // Vertical line - use span for element-to-element guides
                  const y1 = guide.span ? guide.span.start : 0;
                  const y2 = guide.span ? guide.span.end : layout.dimensions.height;

                  return (
                    <g key={`guide-${index}`}>
                      <line
                        x1={guide.position}
                        y1={y1}
                        x2={guide.position}
                        y2={y2}
                        stroke={color}
                        strokeWidth={isElementGuide ? '2' : '1'}
                        strokeDasharray={isCenterGuide ? '8,4' : 'none'}
                      />
                      {/* Glow effect */}
                      <line
                        x1={guide.position}
                        y1={y1}
                        x2={guide.position}
                        y2={y2}
                        stroke={color}
                        strokeWidth={isElementGuide ? '4' : '3'}
                        strokeOpacity="0.3"
                        strokeDasharray={isCenterGuide ? '8,4' : 'none'}
                      />
                      {/* Center indicator circle for canvas center */}
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
                      {/* Small markers at element edges for element-to-element guides */}
                      {isElementGuide && guide.span && (
                        <>
                          <rect x={guide.position - 3} y={guide.span.start - 1} width="6" height="2" fill={color} />
                          <rect x={guide.position - 3} y={guide.span.end - 1} width="6" height="2" fill={color} />
                        </>
                      )}
                    </g>
                  );
                } else {
                  // Horizontal line - use span for element-to-element guides
                  const x1 = guide.span ? guide.span.start : 0;
                  const x2 = guide.span ? guide.span.end : layout.dimensions.width;

                  return (
                    <g key={`guide-${index}`}>
                      <line
                        x1={x1}
                        y1={guide.position}
                        x2={x2}
                        y2={guide.position}
                        stroke={color}
                        strokeWidth={isElementGuide ? '2' : '1'}
                        strokeDasharray={isCenterGuide ? '8,4' : 'none'}
                      />
                      {/* Glow effect */}
                      <line
                        x1={x1}
                        y1={guide.position}
                        x2={x2}
                        y2={guide.position}
                        stroke={color}
                        strokeWidth={isElementGuide ? '4' : '3'}
                        strokeOpacity="0.3"
                        strokeDasharray={isCenterGuide ? '8,4' : 'none'}
                      />
                      {/* Center indicator circle for canvas center */}
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
                      {/* Small markers at element edges for element-to-element guides */}
                      {isElementGuide && guide.span && (
                        <>
                          <rect x={guide.span.start - 1} y={guide.position - 3} width="2" height="6" fill={color} />
                          <rect x={guide.span.end - 1} y={guide.position - 3} width="2" height="6" fill={color} />
                        </>
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
          
          {/* Overlay draggable handles - sorted by layer, only show visible components and those with visible ancestors, exclude groups */}
          {[...(layout.components || [])]
            .filter(component =>
              component.visible !== false &&
              component.type !== 'group' &&
              !isAncestorHidden(component, layout.components || [])
            ) // Exclude groups and components with hidden ancestors
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
    dynamicList: '#009688',
    group: '#666666'
  };
  return colors[component.type] || '#666';
}