import { describe, it, expect } from 'vitest';
import { bakeShapeComponents } from './shapeExport';
import { ComponentConfig } from '../types';

const shapeComponent = (overrides: Partial<ComponentConfig> = {}): ComponentConfig => ({
  id: 'shape_1',
  type: 'shape',
  position: { x: 10, y: 20 },
  size: { width: 100, height: 50 },
  props: {
    shape: {
      closed: true,
      vertices: [
        { x: 0, y: 0, type: 'corner' },
        { x: 1, y: 0, type: 'corner' },
        { x: 1, y: 1, type: 'corner' },
        { x: 0, y: 1, type: 'corner' },
      ],
    },
    fillType: 'solid',
    fillColor: '#ff0000',
  },
  ...overrides,
});

describe('bakeShapeComponents', () => {
  it('bakes pixel-space pathData into shape props', () => {
    const [baked] = bakeShapeComponents([shapeComponent()]);
    expect(baked.props.shape.pathData).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
    expect(baked.props.shape.vertices).toHaveLength(4); // vertices preserved for re-import
  });

  it('passes non-shape components through untouched', () => {
    const custom = { ...shapeComponent({ id: 'c1' }), type: 'custom' as const };
    const [out] = bakeShapeComponents([custom]);
    expect(out).toBe(custom);
  });

  it('drops shape components with degenerate shape data', () => {
    const broken = shapeComponent();
    broken.props.shape.vertices = broken.props.shape.vertices.slice(0, 2);
    expect(bakeShapeComponents([broken])).toHaveLength(0);
  });

  it('drops shape components with no shape prop at all', () => {
    const empty = shapeComponent();
    delete empty.props.shape;
    expect(bakeShapeComponents([empty])).toHaveLength(0);
  });

  it('rounds component size before baking so path matches exported size', () => {
    const c = shapeComponent({ size: { width: 100.4, height: 50.4 } });
    const [baked] = bakeShapeComponents([c]);
    expect(baked.props.shape.pathData).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
  });
});
