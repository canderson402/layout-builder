import { useEffect, useState } from 'react';
import { ShapeGradient, Vertex } from '../shared/utils/shapePath';

interface ShapePropertiesProps {
  props: Record<string, any>;
  onUpdateProps: (updates: Record<string, any>) => void;
}

// Commit-on-blur so the re-joined display string doesn't fight mid-typing
// (e.g. a trailing space parsing as a 0 entry).
function DashInput({ value, onCommit }: { value: number[] | undefined; onCommit: (dash: number[] | undefined) => void }) {
  const display = (value || []).join(' ');
  const [text, setText] = useState(display);
  useEffect(() => {
    setText(display);
  }, [display]);
  const commit = () => {
    const nums = text
      .split(/[\s,]+/)
      .filter(s => s.length > 0)
      .map(Number)
      .filter(n => Number.isFinite(n) && n >= 0);
    onCommit(nums.length > 0 ? nums : undefined);
  };
  return (
    <input
      type="text"
      placeholder="e.g. 8 4 (empty = solid)"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

const DEFAULT_GRADIENT: ShapeGradient = {
  type: 'linear',
  angle: 0,
  stops: [
    { offset: 0, color: '#4CAF50' },
    { offset: 1, color: '#1B5E20' },
  ],
};

export default function ShapeProperties({ props, onUpdateProps }: ShapePropertiesProps) {
  const fillType = props.fillType || 'solid';
  const gradient: ShapeGradient = props.gradient || DEFAULT_GRADIENT;

  const setGradient = (g: ShapeGradient) => onUpdateProps({ gradient: g });

  const setStop = (i: number, field: 'offset' | 'color', value: number | string) => {
    const stops = gradient.stops.map((s, idx) => (idx === i ? { ...s, [field]: value } : s));
    setGradient({ ...gradient, stops });
  };

  return (
    <div className="property-section shape-properties">
      <h3>Shape Fill</h3>
      <div className="property-field">
        <label>Fill Type</label>
        <select
          value={fillType}
          onChange={e => onUpdateProps({ fillType: e.target.value })}
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="none">None</option>
        </select>
      </div>

      {fillType === 'solid' && (
        <div className="property-field">
          <label>Fill Color</label>
          <input
            type="color"
            value={props.fillColor || '#4CAF50'}
            onChange={e => onUpdateProps({ fillColor: e.target.value })}
          />
        </div>
      )}

      {fillType === 'gradient' && (
        <>
          <div className="property-field">
            <label>Gradient Type</label>
            <select
              value={gradient.type}
              onChange={e => setGradient({ ...gradient, type: e.target.value as 'linear' | 'radial' })}
            >
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </div>
          {gradient.type === 'linear' && (
            <div className="property-field">
              <label>Angle (deg)</label>
              <input
                type="number"
                value={gradient.angle}
                onChange={e => {
                  const angle = Number(e.target.value);
                  setGradient({ ...gradient, angle: Number.isFinite(angle) ? angle : 0 });
                }}
              />
            </div>
          )}
          {gradient.stops.map((stop, i) => (
            <div className="property-field" key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={stop.teamColor || 'custom'}
                onChange={e => {
                  const v = e.target.value;
                  const stops = gradient.stops.map((s, idx) => {
                    if (idx !== i) return s;
                    const { teamColor: _teamColor, ...rest } = s;
                    return v === 'home' || v === 'away' ? { ...rest, teamColor: v as 'home' | 'away' } : rest;
                  });
                  setGradient({ ...gradient, stops });
                }}
                aria-label="Stop color source"
              >
                <option value="custom">Custom</option>
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              {!stop.teamColor && (
                <input
                  type="color"
                  value={stop.color}
                  onChange={e => setStop(i, 'color', e.target.value)}
                />
              )}
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(stop.offset * 100)}
                onChange={e => setStop(i, 'offset', Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)}
                style={{ width: 64 }}
              />
              <span>%</span>
              {gradient.stops.length > 2 && (
                <button
                  onClick={() => setGradient({ ...gradient, stops: gradient.stops.filter((_, idx) => idx !== i) })}
                  aria-label="Remove stop"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setGradient({ ...gradient, stops: [...gradient.stops, { offset: 1, color: '#ffffff' }] })}
          >
            + Add Stop
          </button>
        </>
      )}

      {fillType !== 'none' && (
        <div className="property-field">
          <label>Fill Opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={props.fillOpacity ?? 1}
            onChange={e => onUpdateProps({ fillOpacity: Number(e.target.value) })}
          />
        </div>
      )}

      <h3>Shape Stroke</h3>
      <div className="property-field">
        <label>Stroke Width</label>
        <input
          type="number"
          min={0}
          value={props.strokeWidth ?? 0}
          onChange={e => onUpdateProps({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>
      {(props.strokeWidth ?? 0) > 0 && (
        <>
          <div className="property-field">
            <label>Stroke Color</label>
            <input
              type="color"
              value={props.strokeColor || '#ffffff'}
              onChange={e => onUpdateProps({ strokeColor: e.target.value })}
            />
          </div>
          <div className="property-field">
            <label>Stroke Opacity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={props.strokeOpacity ?? 1}
              onChange={e => onUpdateProps({ strokeOpacity: Number(e.target.value) })}
            />
          </div>
          <div className="property-field">
            <label>Dash</label>
            <DashInput
              value={props.strokeDash}
              onCommit={dash => onUpdateProps({ strokeDash: dash })}
            />
          </div>
          <div className="property-field">
            <label>Cap</label>
            <select
              value={props.strokeCap || 'butt'}
              onChange={e => onUpdateProps({ strokeCap: e.target.value })}
            >
              <option value="butt">Flat</option>
              <option value="round">Round</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

interface VertexInspectorProps {
  vertex: Vertex;
  index: number;
  size: { width: number; height: number };
  onUpdateVertex: (index: number, vertex: Vertex) => void;
}

// Commit-on-blur/Enter numeric input so typing multi-digit values doesn't
// fight the rounded display value (and each edit is a single undo step).
function PxInput({ label, value, onCommit }: { label: string; value: number; onCommit: (px: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setText(String(value));
  };
  return (
    <div className="property-field">
      <label>{label}</label>
      <input
        type="number"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function VertexInspector({ vertex, index, size, onUpdateVertex }: VertexInspectorProps) {
  const setNum = (field: 'x' | 'y', px: number, dim: number) => {
    onUpdateVertex(index, { ...vertex, [field]: dim > 0 ? px / dim : 0 });
  };
  return (
    <div className="property-section vertex-inspector">
      <h3>Vertex {index + 1}</h3>
      <PxInput
        label="X (px)"
        value={Math.round(vertex.x * size.width)}
        onCommit={px => setNum('x', px, size.width)}
      />
      <PxInput
        label="Y (px)"
        value={Math.round(vertex.y * size.height)}
        onCommit={px => setNum('y', px, size.height)}
      />
      <div className="property-field">
        <label>Type</label>
        <select
          value={vertex.type}
          onChange={e => {
            const type = e.target.value as Vertex['type'];
            if (type === 'corner') {
              onUpdateVertex(index, { x: vertex.x, y: vertex.y, type });
            } else {
              onUpdateVertex(index, {
                ...vertex,
                type,
                hIn: vertex.hIn || { x: -0.15, y: 0 },
                hOut: vertex.hOut || { x: 0.15, y: 0 },
              });
            }
          }}
        >
          <option value="corner">Corner</option>
          <option value="smooth">Smooth</option>
          <option value="broken">Broken</option>
        </select>
      </div>
    </div>
  );
}
