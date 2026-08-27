import { describe, it, expect } from 'vitest';
import {
  EASING_DIRECTIONS,
  EASING_FUNCTIONS,
  ease,
  type Easing,
  type EasingFunction,
} from './easing';

const OVERSHOOTING: EasingFunction[] = ['back', 'elastic'];

const sweep = (easing: Easing, steps = 1000): number[] => {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push(ease(easing, i / steps));
  return out;
};

describe('ease endpoints', () => {
  it('hits 0 and 1 exactly for every function and direction', () => {
    for (const fn of EASING_FUNCTIONS) {
      for (const direction of EASING_DIRECTIONS) {
        const easing: Easing = { fn, direction };
        expect(ease(easing, 0), `${fn}/${direction} at t=0`).toBe(0);
        expect(ease(easing, 1), `${fn}/${direction} at t=1`).toBe(1);
      }
    }
  });

  it('stays finite across the whole domain', () => {
    for (const fn of EASING_FUNCTIONS) {
      for (const direction of EASING_DIRECTIONS) {
        for (const value of sweep({ fn, direction })) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

describe('ease shape', () => {
  it('overshoots only where a physical overshoot is intended', () => {
    for (const fn of EASING_FUNCTIONS) {
      for (const direction of EASING_DIRECTIONS) {
        const values = sweep({ fn, direction });
        const min = Math.min(...values);
        const max = Math.max(...values);
        const overshoots = min < -1e-9 || max > 1 + 1e-9;
        expect(overshoots, `${fn}/${direction} range [${min}, ${max}]`)
          .toBe(OVERSHOOTING.includes(fn));
      }
    }
  });

  it('makes each successive bounce shallower', () => {
    const values = sweep({ fn: 'bounce', direction: 'out' });
    const dips: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] <= values[i - 1] && values[i] <= values[i + 1]) dips.push(values[i]);
    }
    expect(dips.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < dips.length; i++) {
      expect(dips[i]).toBeGreaterThan(dips[i - 1]);
    }
  });

  it('does not jump straight to the end value at the start of an elastic out', () => {
    expect(ease({ fn: 'elastic', direction: 'out' }, 0.02)).toBeLessThan(0.9);
  });

  it('increases monotonically for the non-overshooting functions', () => {
    for (const fn of EASING_FUNCTIONS) {
      if (OVERSHOOTING.includes(fn) || fn === 'bounce') continue;
      for (const direction of EASING_DIRECTIONS) {
        const values = sweep({ fn, direction }, 200);
        for (let i = 1; i < values.length; i++) {
          expect(values[i], `${fn}/${direction} at step ${i}`)
            .toBeGreaterThanOrEqual(values[i - 1] - 1e-12);
        }
      }
    }
  });
});

describe('ease parameters', () => {
  it('scales elastic overshoot with amplitude while keeping the endpoints', () => {
    const standard = Math.max(...sweep({ fn: 'elastic', direction: 'out' }));
    const wider = Math.max(...sweep({ fn: 'elastic', direction: 'out', amplitude: 2 }));
    expect(wider).toBeGreaterThan(standard);
    expect(ease({ fn: 'elastic', direction: 'out', amplitude: 2 }, 0)).toBe(0);
    expect(ease({ fn: 'elastic', direction: 'out', amplitude: 2 }, 1)).toBe(1);
  });

  it('scales back overshoot with amplitude', () => {
    const standard = Math.max(...sweep({ fn: 'back', direction: 'out' }));
    const wider = Math.max(...sweep({ fn: 'back', direction: 'out', amplitude: 4 }));
    expect(wider).toBeGreaterThan(standard);
  });

  it('treats a back amplitude of exactly 0 as "no overshoot", not the default', () => {
    const values = sweep({ fn: 'back', direction: 'out', amplitude: 0 });
    values.forEach(v => expect(v).toBeLessThanOrEqual(1));
    expect(ease({ fn: 'back', direction: 'out', amplitude: 0 }, 0)).toBe(0);
    expect(ease({ fn: 'back', direction: 'out', amplitude: 0 }, 1)).toBe(1);
  });

  it('holds endpoints across the whole amplitude and period space', () => {
    for (const amplitude of [1, 1.0001, 1.5, 2, 5, 20, 0.5, 0, -3]) {
      for (const period of [0.1, 0.3, 0.45, 1, 3]) {
        for (const direction of EASING_DIRECTIONS) {
          const easing: Easing = { fn: 'elastic', direction, amplitude, period };
          const label = `a=${amplitude} p=${period} ${direction}`;
          expect(ease(easing, 0), label).toBe(0);
          expect(ease(easing, 1), label).toBe(1);
          for (const value of sweep(easing, 200)) {
            expect(Number.isFinite(value), label).toBe(true);
          }
        }
      }
    }
  });

  it('falls back to defaults for degenerate parameters', () => {
    for (const bad of [{ amplitude: 0 }, { period: 0 }, { amplitude: -5 }, { period: -1 }]) {
      for (const fn of ['elastic', 'back'] as const) {
        for (const direction of EASING_DIRECTIONS) {
          for (const t of [0, 0.001, 0.5, 0.999, 1]) {
            expect(Number.isFinite(ease({ fn, direction, ...bad }, t))).toBe(true);
          }
        }
      }
    }
  });
});

describe('ease guards', () => {
  it('clamps t outside [0, 1]', () => {
    expect(ease({ fn: 'cubic', direction: 'out' }, -1)).toBe(0);
    expect(ease({ fn: 'cubic', direction: 'out' }, 2)).toBe(1);
  });

  it('returns 0 rather than propagating a non-finite t', () => {
    expect(ease({ fn: 'cubic', direction: 'out' }, NaN)).toBe(0);
    expect(ease({ fn: 'cubic', direction: 'out' }, Infinity)).toBe(0);
  });

  it('passes t through when there is no easing spec', () => {
    expect(ease(undefined, 0.42)).toBe(0.42);
  });

  it('passes t through for an unrecognised function, so old data degrades to linear', () => {
    expect(ease({ fn: 'nope' as EasingFunction, direction: 'out' }, 0.5)).toBe(0.5);
  });
});
