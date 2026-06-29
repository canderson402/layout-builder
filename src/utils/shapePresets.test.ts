import { describe, it, expect } from 'vitest';
import { SHAPE_PRESETS, SHAPE_PRESET_LIST } from './shapePresets';

describe('SHAPE_PRESETS', () => {
  it('exposes all 7 presets in toolbar order', () => {
    expect(SHAPE_PRESET_LIST.map(p => p.key)).toEqual([
      'rectangle', 'ellipse', 'triangle', 'parallelogram', 'chevron', 'star', 'line',
    ]);
  });

  it('keeps every vertex within the unit box', () => {
    for (const preset of SHAPE_PRESET_LIST) {
      for (const v of preset.shape.vertices) {
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.x).toBeLessThanOrEqual(1);
        expect(v.y).toBeGreaterThanOrEqual(0);
        expect(v.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('only the line is open and stroke-only', () => {
    for (const preset of SHAPE_PRESET_LIST) {
      expect(preset.shape.closed).toBe(preset.key !== 'line');
    }
    expect(SHAPE_PRESETS.line.props?.fillType).toBe('none');
    expect(SHAPE_PRESETS.line.props?.strokeWidth).toBeGreaterThan(0);
  });

  it('closed presets have at least 3 vertices', () => {
    for (const preset of SHAPE_PRESET_LIST) {
      expect(preset.shape.vertices.length).toBeGreaterThanOrEqual(preset.shape.closed ? 3 : 2);
    }
  });
});
