import React, { useState } from 'react';
import { ComponentConfig, LayoutConfig } from '../types';
import './PropertyPanel.css';

interface PropertyPanelProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onUpdateComponent: (id: string, updates: Partial<ComponentConfig>) => void;
  onUpdateLayout: (layout: LayoutConfig) => void;
}

export default function PropertyPanel({
  layout,
  selectedComponents,
  onUpdateComponent,
  onUpdateLayout
}: PropertyPanelProps) {
  const component = selectedComponents.length === 1 
    ? layout.components.find(c => c.id === selectedComponents[0])
    : null;
  
  // State for collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
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

  return (
    <div className="property-panel">
      <div className="property-header">
        <h3>{component.type} Properties</h3>
        {component.team && (
          <span className="team-badge">{component.team}</span>
        )}
      </div>
      
      <div className="property-content">
        <div className="property-section">
          <h4>Position & Size</h4>
          <div className="property-grid">
            <div className="property-field">
              <label>X (px)</label>
              <input
                type="number"
                value={Math.round((component.position.x / 100) * layout.dimensions.width)}
                onChange={(e) => {
                  const pixelValue = parseInt(e.target.value) || 0;
                  const percentValue = (pixelValue / layout.dimensions.width) * 100;
                  onUpdateComponent(component.id, {
                    position: { ...component.position, x: percentValue }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Y (px)</label>
              <input
                type="number"
                value={Math.round((component.position.y / 100) * layout.dimensions.width)}
                onChange={(e) => {
                  const pixelValue = parseInt(e.target.value) || 0;
                  const percentValue = (pixelValue / layout.dimensions.width) * 100;
                  onUpdateComponent(component.id, {
                    position: { ...component.position, y: percentValue }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Width (px)</label>
              <input
                type="number"
                value={Math.round((component.size.width / 100) * layout.dimensions.width)}
                onChange={(e) => {
                  const pixelValue = parseInt(e.target.value) || 0;
                  const percentValue = (pixelValue / layout.dimensions.width) * 100;
                  onUpdateComponent(component.id, {
                    size: { ...component.size, width: percentValue }
                  });
                }}
              />
            </div>
            <div className="property-field">
              <label>Height (px)</label>
              <input
                type="number"
                value={Math.round((component.size.height / 100) * layout.dimensions.width)}
                onChange={(e) => {
                  const pixelValue = parseInt(e.target.value) || 0;
                  const percentValue = (pixelValue / layout.dimensions.width) * 100;
                  onUpdateComponent(component.id, {
                    size: { ...component.size, height: percentValue }
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="property-section">
          <h4>Layer (Z-Index)</h4>
          <div className="property-grid">
            <div className="property-field">
              <label>Layer</label>
              <div className="radius-input-group">
                <button
                  className="radius-quick-button minus"
                  title="Move Behind"
                  onClick={() => {
                    const currentLayer = component.layer || 0;
                    onUpdateComponent(component.id, { layer: currentLayer - 1 });
                  }}
                >
                  -1
                </button>
                <input
                  type="number"
                  value={component.layer || 0}
                  onChange={(e) => onUpdateComponent(component.id, {
                    layer: parseInt(e.target.value) || 0
                  })}
                />
                <button
                  className="radius-quick-button"
                  title="Move Front"
                  onClick={() => {
                    const currentLayer = component.layer || 0;
                    onUpdateComponent(component.id, { layer: currentLayer + 1 });
                  }}
                >
                  +1
                </button>
              </div>
            </div>
          </div>
        </div>

        {component.team && (
          <div className="property-section">
            <h4>Team</h4>
            <select
              value={component.team}
              onChange={(e) => onUpdateComponent(component.id, {
                team: e.target.value as 'home' | 'away'
              })}
            >
              <option value="home">Home Team</option>
              <option value="away">Away Team</option>
            </select>
          </div>
        )}

        <div className="property-section">
          <h4>Text Properties</h4>
          <div className="property-field">
            <label>Font Size</label>
            <input
              type="number"
              value={component.props?.fontSize || 24}
              onChange={(e) => onUpdateComponent(component.id, {
                props: { ...component.props, fontSize: parseInt(e.target.value) || 24 }
              })}
            />
          </div>
          
          <div className="property-field">
            <label>Text Color</label>
            <input
              type="color"
              value={component.props?.textColor || '#ffffff'}
              onChange={(e) => onUpdateComponent(component.id, {
                props: { ...component.props, textColor: e.target.value }
              })}
            />
          </div>
          
          <div className="property-field">
            <label>Text Alignment</label>
            <select
              value={component.props?.textAlign || 'center'}
              onChange={(e) => onUpdateComponent(component.id, {
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
                value={component.props.label || ''}
                onChange={(e) => onUpdateComponent(component.id, {
                  props: { ...component.props, label: e.target.value }
                })}
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
                onChange={(e) => onUpdateComponent(component.id, {
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
                  onChange={(e) => onUpdateComponent(component.id, {
                    props: { ...component.props, showPossessionArrows: e.target.checked }
                  })}
                />
                Show Possession Arrows
              </label>
            </div>
          )}
        </div>

        {component.type === 'custom' && (
          <div className="property-section">
            <h4>Custom Data Configuration</h4>
            
            <div className="property-field">
              <label>Data Path</label>
              <select
                value={component.props?.dataPath || 'gameClock'}
                onChange={(e) => onUpdateComponent(component.id, {
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
              </select>
            </div>

            <div className="property-field">
              <label>Display Label</label>
              <input
                type="text"
                value={component.props?.label || ''}
                placeholder="Optional label"
                onChange={(e) => onUpdateComponent(component.id, {
                  props: { ...component.props, label: e.target.value }
                })}
              />
            </div>

            <div className="property-field">
              <label>Format Type</label>
              <select
                value={component.props?.format || 'text'}
                onChange={(e) => onUpdateComponent(component.id, {
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
                  value={component.props?.prefix || ''}
                  placeholder="e.g., '$', '#'"
                  onChange={(e) => onUpdateComponent(component.id, {
                    props: { ...component.props, prefix: e.target.value }
                  })}
                />
              </div>
              <div className="property-field">
                <label>Suffix</label>
                <input
                  type="text"
                  value={component.props?.suffix || ''}
                  placeholder="e.g., 'pts', '%'"
                  onChange={(e) => onUpdateComponent(component.id, {
                    props: { ...component.props, suffix: e.target.value }
                  })}
                />
              </div>
            </div>

            <div className="property-grid">
              <div className="property-field">
                <label>Background Color</label>
                <input
                  type="color"
                  value={component.props?.backgroundColor || '#000000'}
                  onChange={(e) => onUpdateComponent(component.id, {
                    props: { ...component.props, backgroundColor: e.target.value }
                  })}
                />
              </div>
              <div className="property-field">
                <label>Text Color</label>
                <input
                  type="color"
                  value={component.props?.textColor || '#ffffff'}
                  onChange={(e) => onUpdateComponent(component.id, {
                    props: { ...component.props, textColor: e.target.value }
                  })}
                />
              </div>
            </div>

            <div className="property-section">
              <h4>Border & Corners</h4>
              
              <div className="property-grid">
                <div className="property-field">
                  <label>Border Width (px)</label>
                  <input
                    type="number"
                    value={component.props?.borderWidth || 0}
                    min="0"
                    max="20"
                    onChange={(e) => onUpdateComponent(component.id, {
                      props: { ...component.props, borderWidth: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div className="property-field">
                  <label>Border Color</label>
                  <input
                    type="color"
                    value={component.props?.borderColor || '#ffffff'}
                    onChange={(e) => onUpdateComponent(component.id, {
                      props: { ...component.props, borderColor: e.target.value }
                    })}
                  />
                </div>
              </div>

              <h5>Individual Borders</h5>
              <div className="border-sides-grid">
                <div className="border-side-control">
                  <button
                    className={`border-toggle ${(component.props?.borderTopWidth !== undefined ? component.props?.borderTopWidth : (component.props?.borderWidth || 1)) !== 0 ? 'active' : ''}`}
                    onClick={() => onUpdateComponent(component.id, {
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
                    onClick={() => onUpdateComponent(component.id, {
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
                    onClick={() => onUpdateComponent(component.id, {
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
                    onClick={() => onUpdateComponent(component.id, {
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
                  onChange={(e) => onUpdateComponent(component.id, {
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
                      onClick={() => onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, paddingTop: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => onUpdateComponent(component.id, {
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
                      onClick={() => onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, paddingRight: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => onUpdateComponent(component.id, {
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
                      onClick={() => onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, paddingBottom: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => onUpdateComponent(component.id, {
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
                      onClick={() => onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, paddingLeft: Math.max(0, parseInt(e.target.value) || 0) }
                      })}
                    />
                    <button
                      className="radius-quick-button"
                      onClick={() => onUpdateComponent(component.id, {
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
                        onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, borderTopLeftRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderTopLeftRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        onUpdateComponent(component.id, {
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
                        onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, borderTopRightRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderTopRightRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        onUpdateComponent(component.id, {
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
                        onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, borderBottomLeftRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderBottomLeftRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        onUpdateComponent(component.id, {
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
                        onUpdateComponent(component.id, {
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
                      onChange={(e) => onUpdateComponent(component.id, {
                        props: { ...component.props, borderBottomRightRadius: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <button
                      onClick={() => {
                        const currentValue = component.props?.borderBottomRightRadius || 0;
                        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
                        onUpdateComponent(component.id, {
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
            </div>
          </div>
        )}

      </div>
    </div>
  );
}