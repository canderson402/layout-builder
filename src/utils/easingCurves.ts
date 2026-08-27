import { EASING_FUNCTIONS, type EasingDirection, type EasingFunction } from '../shared/utils/easing';
import type { Easing, Interpolation } from '../shared/utils/overlayTimeline';

export type CurveValue = string;

export interface CurveOption {
  value: CurveValue;
  label: string;
}

export interface CurveGroup {
  label: string;
  options: readonly CurveOption[];
}

const EASE_PREFIX = 'ease:';

const CURVE_LABELS: Record<EasingFunction, string> = {
  sine: 'Sinusoidal',
  quad: 'Quadratic',
  cubic: 'Cubic',
  quart: 'Quartic',
  quint: 'Quintic',
  expo: 'Exponential',
  circ: 'Circular',
  back: 'Back',
  bounce: 'Bounce',
  elastic: 'Elastic',
};

const STRENGTH_CURVES: readonly EasingFunction[] = [
  'sine', 'quad', 'cubic', 'quart', 'quint', 'expo', 'circ',
];

const DYNAMIC_CURVES: readonly EasingFunction[] = ['back', 'bounce', 'elastic'];

const easedOption = (fn: EasingFunction): CurveOption => ({
  value: `${EASE_PREFIX}${fn}`,
  label: CURVE_LABELS[fn],
});

export const CURVE_GROUPS: readonly CurveGroup[] = [
  {
    label: 'Interpolation',
    options: [
      { value: 'constant', label: 'Constant' },
      { value: 'linear', label: 'Linear' },
      { value: 'bezier', label: 'Bézier' },
    ],
  },
  { label: 'Easing (by strength)', options: STRENGTH_CURVES.map(easedOption) },
  { label: 'Dynamic Effects', options: DYNAMIC_CURVES.map(easedOption) },
];

export const EASING_DIRECTION_LABELS: Record<EasingDirection, string> = {
  in: 'Ease In',
  out: 'Ease Out',
  inOut: 'Ease In-Out',
};

export const DEFAULT_EASING_DIRECTION: EasingDirection = 'out';

export function curveValueFor(interpolation: Interpolation, easing: Easing | undefined): CurveValue {
  if (interpolation !== 'eased') return interpolation;
  if (!easing || !EASING_FUNCTIONS.includes(easing.fn)) return 'linear';
  return `${EASE_PREFIX}${easing.fn}`;
}

export function parseCurveValue(
  value: CurveValue,
): { interpolation: Interpolation; fn?: EasingFunction } {
  if (value === 'linear' || value === 'bezier' || value === 'constant') {
    return { interpolation: value };
  }
  if (value.startsWith(EASE_PREFIX)) {
    const fn = value.slice(EASE_PREFIX.length) as EasingFunction;
    if (EASING_FUNCTIONS.includes(fn)) return { interpolation: 'eased', fn };
  }
  return { interpolation: 'linear' };
}

const AMPLITUDE_FUNCTIONS: readonly EasingFunction[] = ['back', 'elastic'];
const PERIOD_FUNCTIONS: readonly EasingFunction[] = ['elastic'];

export function easingSupportsAmplitude(fn: EasingFunction): boolean {
  return AMPLITUDE_FUNCTIONS.includes(fn);
}

export function easingSupportsPeriod(fn: EasingFunction): boolean {
  return PERIOD_FUNCTIONS.includes(fn);
}
