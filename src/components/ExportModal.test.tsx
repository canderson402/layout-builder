import { describe, it, expect } from 'vitest';
import { cleanLayoutForExport } from './ExportModal';
import { SHAPE_PRESETS, SHAPE_PRESET_LIST } from '../utils/shapePresets';
import { ComponentConfig, LayoutConfig } from '../types';

// Mirrors what addShape + getDefaultProps('shape') produce in App.tsx
const shapeFromPreset = (presetKey: string, overrides: Partial<ComponentConfig> = {}): ComponentConfig => {
  const preset = SHAPE_PRESETS[presetKey];
  return {
    id: `shape_${presetKey}`,
    displayName: preset.label,
    type: 'shape',
    position: { x: 100.4, y: 200.6 },
    size: { ...preset.defaultSize },
    layer: 1,
    props: {
      shape: structuredClone(preset.shape),
      fillType: 'solid',
      fillColor: '#4CAF50',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 0,
      strokeOpacity: 1,
      strokeCap: 'butt',
      ...(preset.props || {}),
    },
    ...overrides,
  };
};

const buildLayout = (components: ComponentConfig[]): LayoutConfig => ({
  name: 'basketball',
  components,
  backgroundColor: '#000000',
  dimensions: { width: 1920, height: 1080 },
});

describe('cleanLayoutForExport (shape pipeline integration)', () => {
  it('exports all 7 presets with baked pathData and preserved vertices', () => {
    const layout = buildLayout(SHAPE_PRESET_LIST.map(p => shapeFromPreset(p.key)));
    const out = cleanLayoutForExport(layout);
    const shapes = out.components.filter(c => c.type === 'shape');

    expect(shapes).toHaveLength(7);
    for (const s of shapes) {
      expect(s.props.shape.pathData).toMatch(/^M /);
      expect(s.props.shape.vertices.length).toBeGreaterThanOrEqual(2);
      // positions/sizes rounded to integers
      expect(Number.isInteger(s.position.x)).toBe(true);
      expect(Number.isInteger(s.size.width)).toBe(true);
      // no image/text noise injected into shape props
      expect(s.props.imageSource).toBeUndefined();
      expect(s.props.measuredLeftBearing).toBeUndefined();
    }
  });

  it('bakes pathData matching the rounded component size', () => {
    const rect = shapeFromPreset('rectangle', { size: { width: 100.4, height: 50.4 } });
    const out = cleanLayoutForExport(buildLayout([rect]));
    expect(out.components[0].props.shape.pathData).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
  });

  it('keeps the line preset open and stroke-only', () => {
    const out = cleanLayoutForExport(buildLayout([shapeFromPreset('line')]));
    const line = out.components[0];
    expect(line.props.shape.closed).toBe(false);
    expect(line.props.shape.pathData).not.toContain('Z');
    expect(line.props.fillType).toBe('none');
    expect(line.props.strokeWidth).toBe(4);
  });

  it('preserves gradients with per-stop team bindings, dash, opacity, and root team color', () => {
    const styled = shapeFromPreset('parallelogram', {
      useTeamColor: false,
      teamColorSide: 'home',
    });
    styled.props = {
      ...styled.props,
      fillType: 'gradient',
      gradient: {
        type: 'linear',
        angle: 45,
        stops: [
          { offset: 0, color: '#111111', teamColor: 'home' },
          { offset: 0.5, color: '#333333' },
          { offset: 1, color: '#222222', teamColor: 'away' },
        ],
      },
      fillOpacity: 0.5,
      strokeWidth: 6,
      strokeDash: [8, 4],
      strokeCap: 'round',
    };
    const out = cleanLayoutForExport(buildLayout([styled]));
    const props = out.components[0].props;

    expect(props.gradient.type).toBe('linear');
    expect(props.gradient.angle).toBe(45);
    expect(props.gradient.stops).toEqual([
      { offset: 0, color: '#111111', teamColor: 'home' },
      { offset: 0.5, color: '#333333' },
      { offset: 1, color: '#222222', teamColor: 'away' },
    ]);
    expect(props.fillOpacity).toBe(0.5);
    expect(props.strokeDash).toEqual([8, 4]);
    expect(props.strokeCap).toBe('round');
    expect(out.components[0].teamColorSide).toBe('home');
  });

  it('drops degenerate shapes but keeps everything else', () => {
    const broken = shapeFromPreset('triangle');
    broken.props.shape.vertices = broken.props.shape.vertices.slice(0, 2); // closed with 2 verts
    const custom: ComponentConfig = {
      id: 'custom_1',
      type: 'custom',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      props: { dataPath: 'homeTeam.score', fontSize: 24 },
    };
    const out = cleanLayoutForExport(buildLayout([broken, shapeFromPreset('star'), custom]));
    expect(out.components.map(c => c.id)).toEqual(['shape_star', 'custom_1']);
  });

  it('survives a JSON round-trip intact (what the TV actually receives)', () => {
    const layout = buildLayout(SHAPE_PRESET_LIST.map(p => shapeFromPreset(p.key)));
    const out = cleanLayoutForExport(layout);
    const roundTripped = JSON.parse(JSON.stringify(out));
    expect(roundTripped).toEqual(out);
  });

  it('re-import round-trip: exported vertices regenerate the identical pathData', () => {
    const out = cleanLayoutForExport(buildLayout([shapeFromPreset('ellipse')]));
    const exported = JSON.parse(JSON.stringify(out));
    // Simulate re-import (builder trusts vertices, ignores pathData) + re-export
    const reExported = cleanLayoutForExport(exported);
    expect(reExported.components[0].props.shape.pathData).toBe(out.components[0].props.shape.pathData);
    expect(reExported.components[0].props.shape.vertices).toEqual(out.components[0].props.shape.vertices);
  });
});
