import React from 'react';
import { ComponentConfig } from '../types';
import './Toolbar.css';

interface ToolbarProps {
  onAddComponent: (type: ComponentConfig['type']) => void;
}

const COMPONENT_TYPES = [
  { type: 'teamName', label: 'Team Name', icon: 'Aa' },
  { type: 'score', label: 'Score', icon: '#' },
  { type: 'clock', label: 'Clock', icon: '12:34' },
  { type: 'period', label: 'Period/Quarter', icon: 'Q' },
  { type: 'fouls', label: 'Fouls', icon: 'F' },
  { type: 'timeouts', label: 'Timeouts', icon: '---' },
  { type: 'bonus', label: 'Bonus', icon: 'B+' },
  { type: 'custom', label: 'Custom', icon: '+' },
  { type: 'leaderboardList', label: 'Leaderboard', icon: '#1' },
] as const;

export default function Toolbar({ onAddComponent }: ToolbarProps) {
  return (
    <nav className="toolbar" role="toolbar" aria-label="Add components">
      <div className="toolbar-header">
        <h2 id="toolbar-heading">Components</h2>
      </div>
      <div className="toolbar-content" aria-labelledby="toolbar-heading">
        {COMPONENT_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            className="component-button"
            onClick={() => onAddComponent(type)}
            aria-label={`Add ${label} component`}
          >
            <span className="component-icon" aria-hidden="true">{icon}</span>
            <span className="component-label">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}