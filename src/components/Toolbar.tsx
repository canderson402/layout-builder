import React from 'react';
import { ComponentConfig } from '../types';
import './Toolbar.css';

interface ToolbarProps {
  onAddComponent: (type: ComponentConfig['type']) => void;
}

const COMPONENT_TYPES = [
  { type: 'teamName', label: 'Team Name', icon: '🏷️' },
  { type: 'score', label: 'Score', icon: '🏆' },
  { type: 'clock', label: 'Clock', icon: '⏰' },
  { type: 'period', label: 'Period/Quarter', icon: '📊' },
  { type: 'fouls', label: 'Fouls', icon: '⚠️' },
  { type: 'timeouts', label: 'Timeouts', icon: '⏸️' },
  { type: 'bonus', label: 'Bonus', icon: '⭐' },
  { type: 'custom', label: 'Custom', icon: '🔧' },
] as const;

export default function Toolbar({ onAddComponent }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-header">
        <h3>Components</h3>
      </div>
      <div className="toolbar-content">
        {COMPONENT_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            className="component-button"
            onClick={() => onAddComponent(type)}
            title={`Add ${label}`}
          >
            <span className="component-icon">{icon}</span>
            <span className="component-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}