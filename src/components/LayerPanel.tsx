import React, { useState, useRef } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import './LayerPanel.css';

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

interface LayerPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onAddComponent: (type: ComponentConfig['type'], position?: { x: number, y: number }, size?: { width: number, height: number }, customProps?: Record<string, any>, customDisplayName?: string) => void;
  onStartDragOperation?: () => void;
  onEndDragOperation?: (description: string) => void;
}

interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  dropPosition: 'before' | 'after' | 'child' | null;
}

export default function LayerPanel({
  layout,
  selectedComponents,
  onSelectComponents,
  onUpdateComponent,
  onAddComponent,
  onStartDragOperation,
  onEndDragOperation
}: LayerPanelProps) {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [pendingToggleComponent, setPendingToggleComponent] = useState<boolean>(false);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    dragOverId: null,
    dropPosition: null
  });
  const dragCounter = useRef(0);

  // Handle applying toggle properties to newly created component
  React.useEffect(() => {
    if (pendingToggleComponent && layout.components.length > 0) {
      const newestComponent = layout.components[layout.components.length - 1];
      if (newestComponent && !newestComponent.props?.canToggle) {
        onUpdateComponent(newestComponent.id, {
          props: {
            ...newestComponent.props,
            dataPath: 'none',
            label: '',
            fontSize: 24,
            format: 'text',
            prefix: '',
            suffix: '',
            backgroundColor: '#E74C3C',
            textColor: '#ffffff',
            textAlign: 'center',
            borderWidth: 0,
            borderColor: '#ffffff',
            borderStyle: 'solid',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            canToggle: true,
            toggleState: false,
            state1Props: {
              backgroundColor: '#E74C3C',
              textColor: '#ffffff'
            },
            state2Props: {
              backgroundColor: '#4CAF50',
              textColor: '#ffffff'
            }
          }
        });
        setPendingToggleComponent(false);
      }
    }
  }, [layout.components.length, pendingToggleComponent, onUpdateComponent]);

  // Build hierarchical structure from flat list
  const buildHierarchy = () => {
    const components = layout.components || [];
    const rootComponents: ComponentConfig[] = [];
    const childrenMap: Map<string, ComponentConfig[]> = new Map();

    // First pass: separate root components and build children map
    components.forEach(component => {
      if (component.parentId) {
        const siblings = childrenMap.get(component.parentId) || [];
        siblings.push(component);
        childrenMap.set(component.parentId, siblings);
      } else {
        rootComponents.push(component);
      }
    });

    // Sort by layer (highest first)
    rootComponents.sort((a, b) => (b.layer || 0) - (a.layer || 0));
    childrenMap.forEach(children => {
      children.sort((a, b) => (b.layer || 0) - (a.layer || 0));
    });

    return { rootComponents, childrenMap };
  };

  const { rootComponents, childrenMap } = buildHierarchy();

  const handleComponentClick = (componentId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      if (selectedComponents.includes(componentId)) {
        onSelectComponents(selectedComponents.filter(id => id !== componentId));
      } else {
        onSelectComponents([...selectedComponents, componentId]);
      }
    } else {
      onSelectComponents([componentId]);
    }
  };

  const getComponentDisplayName = (component: ComponentConfig) => {
    if (component.displayName) {
      return component.displayName;
    }
    // Show "Layer" for group type components
    if (component.type === 'group') {
      return 'Layer';
    }
    return component.type;
  };

  const startEditingName = (component: ComponentConfig) => {
    setEditingNameId(component.id);
    setEditingName(component.displayName || getComponentDisplayName(component));
  };

  const saveComponentName = (componentId: string) => {
    if (editingName.trim()) {
      onUpdateComponent(componentId, { displayName: editingName.trim() });
    } else {
      onUpdateComponent(componentId, { displayName: undefined });
    }
    setEditingNameId(null);
    setEditingName('');
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setEditingName('');
  };

  const toggleComponentVisibility = (componentId: string) => {
    const component = (layout.components || []).find(c => c.id === componentId);
    if (component) {
      onUpdateComponent(componentId, { visible: !(component.visible ?? true) });
    }
  };

  const toggleParentCollapsed = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const hasChildren = (componentId: string) => {
    return (childrenMap.get(componentId) || []).length > 0;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', componentId);
    setDragState(prev => ({ ...prev, draggedId: componentId }));
    onStartDragOperation?.();
  };

  const handleDragEnd = () => {
    setDragState({ draggedId: null, dragOverId: null, dropPosition: null });
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, componentId: string) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragState.draggedId && dragState.draggedId !== componentId) {
      setDragState(prev => ({ ...prev, dragOverId: componentId }));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragState(prev => ({ ...prev, dragOverId: null, dropPosition: null }));
    }
  };

  const handleDragOver = (e: React.DragEvent, componentId: string) => {
    e.preventDefault();
    if (!dragState.draggedId || dragState.draggedId === componentId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'child';
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'child'; // Drop in middle = make it a child
    }

    setDragState(prev => ({ ...prev, dragOverId: componentId, dropPosition: position }));
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (!draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    // Check for circular reference (can't drop parent onto its own child)
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = childrenMap.get(parentId) || [];
      for (const child of children) {
        if (child.id === childId) return true;
        if (isDescendant(child.id, childId)) return true;
      }
      return false;
    };

    if (isDescendant(draggedId, targetId)) {
      handleDragEnd();
      return;
    }

    const targetComponent = layout.components.find(c => c.id === targetId);
    const draggedComponent = layout.components.find(c => c.id === draggedId);

    if (!targetComponent || !draggedComponent) {
      handleDragEnd();
      return;
    }

    const { dropPosition } = dragState;

    if (dropPosition === 'child') {
      // Make dragged component a child of target
      onUpdateComponent(draggedId, { parentId: targetId });
      onEndDragOperation?.('Set parent-child relationship');
    } else if (dropPosition === 'before' || dropPosition === 'after') {
      // Move to same level as target (same parent)
      const newParentId = targetComponent.parentId;
      const newLayer = dropPosition === 'before'
        ? (targetComponent.layer || 0) + 1
        : (targetComponent.layer || 0) - 1;

      onUpdateComponent(draggedId, {
        parentId: newParentId || undefined,
        layer: Math.max(0, newLayer)
      });
      onEndDragOperation?.('Reorder component');
    }

    handleDragEnd();
  };

  const renderComponent = (component: ComponentConfig, depth: number = 0) => {
    const children = childrenMap.get(component.id) || [];
    const isCollapsed = collapsedParents.has(component.id);
    const hasChildComponents = children.length > 0;
    const isVisible = component.visible ?? true;
    const isDragging = dragState.draggedId === component.id;
    const isDragOver = dragState.dragOverId === component.id;
    const dropPosition = dragState.dropPosition;
    const isLayer = component.type === 'group';
    const basePadding = 16; // Base left padding from CSS
    const indentPx = depth * 20; // 20px indent per level

    return (
      <div key={component.id} className="layer-component-wrapper">
        <div
          className={`layer-component ${!isLayer && selectedComponents.includes(component.id) ? 'selected' : ''} ${!isVisible ? 'hidden-component' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? `drag-over drag-over-${dropPosition}` : ''} ${isLayer ? 'is-layer' : ''}`}
          style={{ paddingLeft: depth > 0 ? `${basePadding + indentPx}px` : undefined }}
          onClick={(e) => {
            // Layers are not selectable - only components
            if (editingNameId !== component.id && !isLayer) {
              handleComponentClick(component.id, e.ctrlKey || e.metaKey);
            }
          }}
          draggable={editingNameId !== component.id}
          onDragStart={(e) => handleDragStart(e, component.id)}
          onDragEnd={handleDragEnd}
          onDragEnter={(e) => handleDragEnter(e, component.id)}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => handleDragOver(e, component.id)}
          onDrop={(e) => handleDrop(e, component.id)}
        >
          <div className="component-info">
            {/* Collapse toggle for parents */}
            {hasChildComponents ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleParentCollapsed(component.id);
                }}
                className="collapse-btn"
                title={isCollapsed ? `Expand (${children.length} children)` : `Collapse (${children.length} children)`}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span className="collapse-spacer" />
            )}

            {/* Visibility checkbox */}
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => {
                e.stopPropagation();
                toggleComponentVisibility(component.id);
              }}
              className="visibility-checkbox"
              title={isVisible ? 'Hide component' : 'Show component'}
            />

            {editingNameId === component.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => saveComponentName(component.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveComponentName(component.id);
                  } else if (e.key === 'Escape') {
                    cancelEditingName();
                  }
                }}
                className="component-name-input"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="component-name"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditingName(component);
                }}
                title="Double-click to rename"
              >
                {getComponentDisplayName(component)}
              </span>
            )}
          </div>

          <div className="component-actions">
            {editingNameId !== component.id && (
              <>
                {component.props?.canToggle && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateComponent(component.id, {
                        props: {
                          ...component.props,
                          toggleState: !component.props?.toggleState
                        }
                      });
                    }}
                    className="layer-action-btn"
                    style={{
                      backgroundColor: component.props?.toggleState ? '#4CAF50' : '#607D8B',
                      fontSize: '10px',
                      padding: '2px 4px'
                    }}
                    title={`Toggle state: ${component.props?.toggleState ? 'ON' : 'OFF'}`}
                  >
                    {component.props?.toggleState ? 'ON' : 'OFF'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Render children with increased depth for indentation */}
        {hasChildComponents && !isCollapsed && (
          <div className="layer-children">
            {children.map(child => renderComponent(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const createNewLayer = () => {
    onStartDragOperation?.();
    onAddComponent('group', { x: 0, y: 0 }, { width: 0, height: 0 });
    onEndDragOperation?.('Create new layer');
  };

  // Add image component with default image centered on canvas
  const addImageComponent = () => {
    // Use canonical path format - BASE_URL is added at render time by CustomDataDisplay
    const defaultImagePath = '/images/face.png';
    const imageProps = {
      dataPath: 'none',
      imageSource: 'local',
      imagePath: defaultImagePath,
      objectFit: 'none',
      backgroundColor: 'transparent',
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0
    };

    // Load image to get native dimensions and center it
    const img = new window.Image();
    img.onload = () => {
      const nativeWidth = img.naturalWidth;
      const nativeHeight = img.naturalHeight;
      const centerX = (layout.dimensions.width - nativeWidth) / 2;
      const centerY = (layout.dimensions.height - nativeHeight) / 2;

      onAddComponent(
        'custom',
        { x: Math.max(0, centerX), y: Math.max(0, centerY) },
        { width: nativeWidth, height: nativeHeight },
        imageProps,
        'Image'
      );
    };
    img.onerror = () => {
      // Fallback if image doesn't load
      const defaultWidth = 400;
      const defaultHeight = 300;
      const centerX = (layout.dimensions.width - defaultWidth) / 2;
      const centerY = (layout.dimensions.height - defaultHeight) / 2;

      onAddComponent(
        'custom',
        { x: Math.max(0, centerX), y: Math.max(0, centerY) },
        { width: defaultWidth, height: defaultHeight },
        { ...imageProps, objectFit: 'fill', backgroundColor: '#333333' },
        'Image'
      );
    };
    img.src = resolveImagePath(defaultImagePath);
  };

  return (
    <div className="layer-panel">
      <div className="layer-header">
        <div className="layer-header-title">
          <h3>Layers</h3>
          <div className="layer-info">
            {(() => {
              const componentCount = (layout.components || []).filter(c => c.type !== 'group').length;
              const layerCount = (layout.components || []).filter(c => c.type === 'group').length;
              return `${componentCount} component${componentCount !== 1 ? 's' : ''}${layerCount > 0 ? `, ${layerCount} layer${layerCount !== 1 ? 's' : ''}` : ''}`;
            })()}
          </div>
        </div>
        <button
          className="new-layer-btn"
          onClick={createNewLayer}
          title="Create new layer"
        >
          + Layer
        </button>
      </div>

      <div className="layer-content">
        {rootComponents.length === 0 ? (
          <div className="no-components">
            No components in layout
          </div>
        ) : (
          <div className="layer-list">
            {rootComponents.map(component => renderComponent(component))}
          </div>
        )}

        {/* Root drop zone - drop here to unlink from parent */}
        <div
          className={`root-drop-zone ${dragState.draggedId && !dragState.dragOverId ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragState.draggedId) {
              setDragState(prev => ({ ...prev, dragOverId: null, dropPosition: null }));
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId) {
              const draggedComponent = layout.components.find(c => c.id === draggedId);
              if (draggedComponent?.parentId) {
                onUpdateComponent(draggedId, { parentId: undefined });
                onEndDragOperation?.('Unlink from parent');
              }
            }
            handleDragEnd();
          }}
        >
          {dragState.draggedId && (
            <span>Drop here to move to root level</span>
          )}
        </div>

        <div className="layer-help">
          <small>Drag components to reorder. Drop on another to parent.</small>
        </div>
      </div>

      {/* Component Menu */}
      <div className="component-menu">
        <div className="component-menu-header">
          <h4>Quick Add Components</h4>
        </div>
        <div className="component-menu-grid">
          <button
            className="component-menu-item"
            onClick={() => {
              onAddComponent('custom', undefined, { width: 500, height: 500 });
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'preset-component',
                componentType: 'custom',
                size: { width: 500, height: 500 },
                props: {
                  dataPath: 'none',
                  label: 'Basic Component',
                  fontSize: 24,
                  format: 'text',
                  prefix: '',
                  suffix: '',
                  backgroundColor: '#9B59B6',
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
              }));
            }}
            title="Basic Component (500x500px, blue background)"
          >
            <div className="component-menu-icon"></div>
            <div className="component-menu-label">Basic</div>
          </button>

          <button
            className="component-menu-item"
            onClick={() => {
              setPendingToggleComponent(true);
              onAddComponent('custom', undefined, { width: 500, height: 500 });
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'preset-component',
                componentType: 'custom',
                size: { width: 500, height: 500 },
                props: {
                  dataPath: 'none',
                  label: '',
                  fontSize: 24,
                  format: 'text',
                  prefix: '',
                  suffix: '',
                  backgroundColor: '#E74C3C',
                  textColor: '#ffffff',
                  textAlign: 'center',
                  borderWidth: 0,
                  borderColor: '#ffffff',
                  borderStyle: 'solid',
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  canToggle: true,
                  toggleState: false,
                  state1Props: {
                    backgroundColor: '#E74C3C',
                    textColor: '#ffffff'
                  },
                  state2Props: {
                    backgroundColor: '#4CAF50',
                    textColor: '#ffffff'
                  }
                }
              }));
            }}
            title="Toggle Component (500x500px, blue background, pre-configured toggle)"
          >
            <div className="component-menu-icon"></div>
            <div className="component-menu-label">Toggle</div>
          </button>

          <button
            className="component-menu-item"
            onClick={() => onAddComponent('dynamicList')}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'preset-component',
                componentType: 'dynamicList'
              }));
            }}
            title="Dynamic List (timeouts, fouls, etc.)"
          >
            <div className="component-menu-icon"></div>
            <div className="component-menu-label">Dynamic List</div>
          </button>

          <button
            className="component-menu-item"
            onClick={addImageComponent}
            title="Image Component (centered, native resolution)"
          >
            <div className="component-menu-icon"></div>
            <div className="component-menu-label">Image</div>
          </button>
        </div>
      </div>
    </div>
  );
}
