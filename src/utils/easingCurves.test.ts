import { describe, it, expect } from 'vitest';
import { EASING_DIRECTIONS, EASING_FUNCTIONS } from '../shared/utils/easing';
import {
  CURVE_GROUPS,
  DEFAULT_EASING_DIRECTION,
  EASING_DIRECTION_LABELS,
  curveValueFor,
  easingSupportsAmplitude,
  easingSupportsPeriod,
  parseCurveValue,
} from './easingCurves';

const allOptions = () => CURVE_GROUPS.flatMap(g => g.options);

describe('CURVE_GROUPS', () => {
  it('lists the three groups in the order the Blender menu shows them', () => {
    expect(CURVE_GROUPS.map(g => g.label)).toEqual([
      'Interpolation',
      'Easing (by strength)',
      'Dynamic Effects',
    ]);
  });

  it('puts the plain interpolation modes in the first group', () => {
    expect(CURVE_GROUPS[0].options.map(o => o.label)).toEqual(['Constant', 'Linear', 'Bézier']);
  });

  it('names the strength curves as Blender does', () => {
    expect(CURVE_GROUPS[1].options.map(o => o.label)).toEqual([
      'Sinusoidal', 'Quadratic', 'Cubic', 'Quartic', 'Quintic', 'Exponential', 'Circular',
    ]);
  });

  it('names the dynamic effects as Blender does, with no direction in the label', () => {
    expect(CURVE_GROUPS[2].options.map(o => o.label)).toEqual(['Back', 'Bounce', 'Elastic']);
  });

  it('covers every easing function exactly once across the two easing groups', () => {
    const eased = [...CURVE_GROUPS[1].options, ...CURVE_GROUPS[2].options];
    expect(eased).toHaveLength(EASING_FUNCTIONS.length);
    const fns = eased.map(o => parseCurveValue(o.value).fn);
    expect(new Set(fns).size).toBe(EASING_FUNCTIONS.length);
    for (const fn of EASING_FUNCTIONS) expect(fns).toContain(fn);
  });

  it('has no label mentioning a direction', () => {
    for (const option of allOptions()) {
      expect(option.label).not.toMatch(/\b(In|Out|In-Out)\b/);
    }
  });

  it('uses unique option values', () => {
    const values = allOptions().map(o => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('curveValueFor', () => {
  it('maps the plain interpolation modes to themselves', () => {
    expect(curveValueFor('linear', undefined)).toBe('linear');
    expect(curveValueFor('bezier', undefined)).toBe('bezier');
    expect(curveValueFor('constant', undefined)).toBe('constant');
  });

  it('maps an eased keyframe to its curve, ignoring direction and parameters', () => {
    expect(curveValueFor('eased', { fn: 'bounce', direction: 'in' })).toBe('ease:bounce');
    expect(curveValueFor('eased', { fn: 'bounce', direction: 'out' })).toBe('ease:bounce');
    expect(curveValueFor('eased', { fn: 'elastic', direction: 'inOut', amplitude: 3.7, period: 0.9 }))
      .toBe('ease:elastic');
  });

  it('falls back to linear for eased with no easing spec', () => {
    expect(curveValueFor('eased', undefined)).toBe('linear');
  });

  it('always returns a value that a rendered option carries', () => {
    const values = new Set(allOptions().map(o => o.value));
    expect(values.has(curveValueFor('linear', undefined))).toBe(true);
    for (const fn of EASING_FUNCTIONS) {
      for (const direction of EASING_DIRECTIONS) {
        expect(values.has(curveValueFor('eased', { fn, direction }))).toBe(true);
      }
    }
  });
});

describe('parseCurveValue', () => {
  it('returns the plain interpolation with no function', () => {
    expect(parseCurveValue('linear')).toEqual({ interpolation: 'linear' });
    expect(parseCurveValue('bezier')).toEqual({ interpolation: 'bezier' });
    expect(parseCurveValue('constant')).toEqual({ interpolation: 'constant' });
  });

  it('returns eased plus the function for a curve value', () => {
    expect(parseCurveValue('ease:elastic')).toEqual({ interpolation: 'eased', fn: 'elastic' });
  });

  it('round-trips every option in the menu', () => {
    for (const option of allOptions()) {
      const parsed = parseCurveValue(option.value);
      if (parsed.fn) {
        expect(curveValueFor('eased', { fn: parsed.fn, direction: 'out' })).toBe(option.value);
      } else {
        expect(curveValueFor(parsed.interpolation, undefined)).toBe(option.value);
      }
    }
  });

  it('falls back to linear for an unrecognised value', () => {
    expect(parseCurveValue('nonsense')).toEqual({ interpolation: 'linear' });
    expect(parseCurveValue('ease:nope')).toEqual({ interpolation: 'linear' });
  });
});

describe('direction metadata', () => {
  it('labels every direction', () => {
    for (const direction of EASING_DIRECTIONS) {
      expect(EASING_DIRECTION_LABELS[direction]).toBeTruthy();
    }
    expect(EASING_DIRECTION_LABELS).toEqual({ in: 'Ease In', out: 'Ease Out', inOut: 'Ease In-Out' });
  });

  it('defaults to easing out, the settle-into-place case', () => {
    expect(DEFAULT_EASING_DIRECTION).toBe('out');
    expect(EASING_DIRECTIONS).toContain(DEFAULT_EASING_DIRECTION);
  });
});

describe('parameter support', () => {
  it('offers amount only for back and elastic', () => {
    for (const fn of EASING_FUNCTIONS) {
      expect(easingSupportsAmplitude(fn)).toBe(fn === 'back' || fn === 'elastic');
    }
  });

  it('offers wobble only for elastic', () => {
    for (const fn of EASING_FUNCTIONS) {
      expect(easingSupportsPeriod(fn)).toBe(fn === 'elastic');
    }
  });
});
