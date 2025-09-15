import React, { useState } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import './LayerPanel.css';

interface LayerPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
}

export default function LayerPanel({
  layout,
  selectedComponents,
  onSelectComponents,
  onUpdateComponent
}: LayerPanelProps) {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Sort components by layer (highest layer first for visual stacking order)
  const sortedComponents = [...(layout.components || [])].sort((a, b) => (b.layer || 0) - (a.layer || 0));

  // Group components by layer
  const componentsByLayer: { [layer: number]: ComponentConfig[] } = {};
  sortedComponents.forEach(component => {
    const layer = component.layer || 0;
    if (!componentsByLayer[layer]) {
      componentsByLayer[layer] = [];
    }
    componentsByLayer[layer].push(component);
  });

  const handleComponentClick = (componentId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Toggle selection
      if (selectedComponents.includes(componentId)) {
        onSelectComponents(selectedComponents.filter(id => id !== componentId));
      } else {
        onSelectComponents([...selectedComponents, componentId]);
      }
    } else {
      // Single selection
      onSelectComponents([componentId]);
    }
  };

  const getComponentDisplayName = (component: ComponentConfig) => {
    // Use displayName if available, otherwise fall back to simple type
    if (component.displayName) {
      return component.displayName;
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
      // If name is empty, remove the custom name (fall back to default)
      onUpdateComponent(componentId, { displayName: undefined });
    }
    setEditingNameId(null);
    setEditingName('');
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setEditingName('');
  };

  const getComponentIcon = (component: ComponentConfig) => {
    const icons = {
      teamName: '🏷️',
      score: '🏆',
      clock: '⏰',
      period: '📊',
      fouls: '❌',
      timeouts: '⏱️',
      bonus: '⭐',
      custom: '📦'
    };
    return icons[component.type] || '📦';
  };

  const moveComponentToLayer = (componentId: string, newLayer: number) => {
    onUpdateComponent(componentId, { layer: newLayer });
  };

  const toggleComponentVisibility = (componentId: string) => {
    const component = (layout.components || []).find(c => c.id === componentId);
    if (component) {
      onUpdateComponent(componentId, { visible: !(component.visible ?? true) });
    }
  };

  const toggleLayerVisibility = (layerNumber: number) => {
    const layerComponents = componentsByLayer[layerNumber];
    if (!layerComponents) return;
    
    // Check if all components in this layer are visible
    const allVisible = layerComponents.every(c => c.visible ?? true);
    
    // Toggle all components in this layer
    layerComponents.forEach(component => {
      onUpdateComponent(component.id, { visible: !allVisible });
    });
  };

  const isLayerVisible = (layerNumber: number) => {
    const layerComponents = componentsByLayer[layerNumber];
    if (!layerComponents || layerComponents.length === 0) return true;
    
    // Layer is considered visible if any component is visible
    return layerComponents.some(c => c.visible ?? true);
  };

  // Get all unique layers in ascending order
  const allLayers = Object.keys(componentsByLayer)
    .map(Number)
    .sort((a, b) => b - a); // Descending order (highest first)

  return (
    <div className="layer-panel">
      <div className="layer-header">
        <h3>Layers</h3>
        <div className="layer-info">
          {(layout.components || []).length} component{(layout.components || []).length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="layer-content">
        {allLayers.length === 0 ? (
          <div className="no-components">
            No components in layout
          </div>
        ) : (
          allLayers.map(layer => (
            <div key={layer} className="layer-group">
              <div className="layer-group-header">
                <div className="layer-header-left">
                  <button
                    onClick={() => toggleLayerVisibility(layer)}
                    className={`layer-visibility-btn ${isLayerVisible(layer) ? 'visible' : 'hidden'}`}
                    title={`${isLayerVisible(layer) ? 'Hide' : 'Show'} layer ${layer}`}
                  >
                    {isLayerVisible(layer) ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <span className="layer-title">Layer {layer}</span>
                </div>
                <span className="layer-count">
                  {componentsByLayer[layer].length} item{componentsByLayer[layer].length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="layer-components">
                {componentsByLayer[layer].map(component => (
                  <div
                    key={component.id}
                    className={`layer-component ${selectedComponents.includes(component.id) ? 'selected' : ''} ${!(component.visible ?? true) ? 'hidden-component' : ''}`}
                    onClick={(e) => {
                      if (editingNameId !== component.id) {
                        handleComponentClick(component.id, e.ctrlKey || e.metaKey);
                      }
                    }}
                  >
                    <div className="component-info">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComponentVisibility(component.id);
                        }}
                        className={`component-visibility-btn ${(component.visible ?? true) ? 'visible' : 'hidden'}`}
                        title={`${(component.visible ?? true) ? 'Hide' : 'Show'} component`}
                      >
                        {(component.visible ?? true) ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <span className="component-icon">
                        {getComponentIcon(component)}
                      </span>
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingName(component);
                            }}
                            className="layer-action-btn"
                            title="Rename component"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveComponentToLayer(component.id, (component.layer || 0) + 1);
                            }}
                            className="layer-action-btn"
                            title="Move up one layer"
                          >
                            ↑
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveComponentToLayer(component.id, Math.max(0, (component.layer || 0) - 1));
                            }}
                            className="layer-action-btn"
                            title="Move down one layer"
                          >
                            ↓
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}