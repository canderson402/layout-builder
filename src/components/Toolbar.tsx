import React from 'react';
import { ComponentConfig } from '../types';
import './Toolbar.css';

interface ToolbarProps {
  onAddComponent: (type: ComponentConfig['type']) => void;
}

const COMPONENT_TYPES = [
  { type: 'teamName', label: 'Team Name', icon: 'TN' },
  { type: 'score', label: 'Score', icon: 'SC' },
  { type: 'clock', label: 'Clock', icon: 'CK' },
  { type: 'period', label: 'Period/Quarter', icon: 'PD' },
  { type: 'fouls', label: 'Fouls', icon: 'FL' },
  { type: 'timeouts', label: 'Timeouts', icon: 'TO' },
  { type: 'bonus', label: 'Bonus', icon: 'BN' },
  { type: 'custom', label: 'Custom', icon: 'CU' },
  { type: 'leaderboardList', label: 'Leaderboard', icon: 'LB' },
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