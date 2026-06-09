import { ShapeData } from '../shared/utils/shapePath';

export interface ShapePreset {
  key: string;
  label: string;
  icon: string;
  shape: ShapeData;
  defaultSize: { width: number; height: number };
  props?: Record<string, unknown>; // prop overrides on top of getDefaultProps('shape')
}

// Ellipse bezier constant for a unit box: (4/3)·tan(π/8) · r, with r = 0.5
const K = 0.276142;

export const SHAPE_PRESETS: Record<string, ShapePreset> = {
  rectangle: {
    key: 'rectangle', label: 'Rectangle', icon: '▭',
    defaultSize: { width: 384, height: 216 },
    shape: {
      closed: true,
      vertices: [
        { x: 0, y: 0, type: 'corner' },
        { x: 1, y: 0, type: 'corner' },
        { x: 1, y: 1, type: 'corner' },
        { x: 0, y: 1, type: 'corner' },
      ],
    },
  },
  ellipse: {
    key: 'ellipse', label: 'Ellipse', icon: '◯',
    defaultSize: { width: 300, height: 300 },
    shape: {
      closed: true,
      vertices: [
        { x: 0.5, y: 0, type: 'smooth', hIn: { x: -K, y: 0 }, hOut: { x: K, y: 0 } },
        { x: 1, y: 0.5, type: 'smooth', hIn: { x: 0, y: -K }, hOut: { x: 0, y: K } },
        { x: 0.5, y: 1, type: 'smooth', hIn: { x: K, y: 0 }, hOut: { x: -K, y: 0 } },
        { x: 0, y: 0.5, type: 'smooth', hIn: { x: 0, y: K }, hOut: { x: 0, y: -K } },
      ],
    },
  },
  triangle: {
    key: 'triangle', label: 'Triangle', icon: '△',
    defaultSize: { width: 300, height: 260 },
    shape: {
      closed: true,
      vertices: [
        { x: 0.5, y: 0, type: 'corner' },
        { x: 1, y: 1, type: 'corner' },
        { x: 0, y: 1, type: 'corner' },
      ],
    },
  },
  parallelogram: {
    key: 'parallelogram', label: 'Slanted Panel', icon: '▱',
    defaultSize: { width: 420, height: 140 },
    shape: {
      closed: true,
      vertices: [
        { x: 0.25, y: 0, type: 'corner' },
        { x: 1, y: 0, type: 'corner' },
        { x: 0.75, y: 1, type: 'corner' },
        { x: 0, y: 1, type: 'corner' },
      ],
    },
  },
  chevron: {
    key: 'chevron', label: 'Chevron', icon: '»',
    defaultSize: { width: 360, height: 160 },
    shape: {
      closed: true,
      vertices: [
        { x: 0, y: 0, type: 'corner' },
        { x: 0.75, y: 0, type: 'corner' },
        { x: 1, y: 0.5, type: 'corner' },
        { x: 0.75, y: 1, type: 'corner' },
        { x: 0, y: 1, type: 'corner' },
        { x: 0.25, y: 0.5, type: 'corner' },
      ],
    },
  },
  star: {
    key: 'star', label: 'Star', icon: '★',
    defaultSize: { width: 280, height: 280 },
    shape: {
      closed: true,
      // 5-point star: outer r=0.5, inner r=0.19, starting at 12 o'clock
      vertices: [
        { x: 0.5, y: 0, type: 'corner' },
        { x: 0.6117, y: 0.3463, type: 'corner' },
        { x: 0.9755, y: 0.3455, type: 'corner' },
        { x: 0.6807, y: 0.5587, type: 'corner' },
        { x: 0.7939, y: 0.9045, type: 'corner' },
        { x: 0.5, y: 0.69, type: 'corner' },
        { x: 0.2061, y: 0.9045, type: 'corner' },
        { x: 0.3193, y: 0.5587, type: 'corner' },
        { x: 0.0245, y: 0.3455, type: 'corner' },
        { x: 0.3883, y: 0.3463, type: 'corner' },
      ],
    },
  },
  line: {
    key: 'line', label: 'Line', icon: '╱',
    defaultSize: { width: 384, height: 24 },
    props: { fillType: 'none', strokeWidth: 4, strokeColor: '#ffffff' },
    shape: {
      closed: false,
      vertices: [
        { x: 0, y: 0.5, type: 'corner' },
        { x: 1, y: 0.5, type: 'corner' },
      ],
    },
  },
};

export const SHAPE_PRESET_LIST: ShapePreset[] = [
  SHAPE_PRESETS.rectangle,
  SHAPE_PRESETS.ellipse,
  SHAPE_PRESETS.triangle,
  SHAPE_PRESETS.parallelogram,
  SHAPE_PRESETS.chevron,
  SHAPE_PRESETS.star,
  SHAPE_PRESETS.line,
];
