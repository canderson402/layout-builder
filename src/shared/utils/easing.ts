export type EasingFunction =
  | 'sine' | 'quad' | 'cubic' | 'quart' | 'quint' | 'expo' | 'circ'
  | 'back' | 'elastic' | 'bounce';

export type EasingDirection = 'in' | 'out' | 'inOut';

export interface Easing {
  fn: EasingFunction;
  direction: EasingDirection;
  amplitude?: number;
  period?: number;
}

export const EASING_FUNCTIONS: readonly EasingFunction[] = [
  'sine', 'quad', 'cubic', 'quart', 'quint', 'expo', 'circ', 'back', 'elastic', 'bounce',
];

export const EASING_DIRECTIONS: readonly EasingDirection[] = ['in', 'out', 'inOut'];

const BACK_C1 = 1.70158;
const DEFAULT_PERIOD = 0.3;
const DEFAULT_PERIOD_INOUT = 0.45;

const finiteOr = (n: number | undefined, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

const finitePositive = (n: number | undefined, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : fallback;

const finiteNonNegative = (n: number | undefined, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback;

const EASE_IN: Record<string, (t: number) => number> = {
  sine: t => 1 - Math.cos((t * Math.PI) / 2),
  quad: t => t * t,
  cubic: t => t * t * t,
  quart: t => t * t * t * t,
  quint: t => t * t * t * t * t,
  expo: t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  circ: t => 1 - Math.sqrt(1 - t * t),
};

function easeInBack(t: number, amplitude: number | undefined): number {
  const c1 = finiteNonNegative(amplitude, 1) * BACK_C1;
  return (c1 + 1) * t * t * t - c1 * t * t;
}

function easeOutBack(t: number, amplitude: number | undefined): number {
  const c1 = finiteNonNegative(amplitude, 1) * BACK_C1;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutBack(t: number, amplitude: number | undefined): number {
  const c2 = finiteNonNegative(amplitude, 1) * BACK_C1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

function elasticParams(
  amplitude: number | undefined,
  period: number | undefined,
  fallbackPeriod: number,
): { a: number; p: number; s: number } {
  const p = finitePositive(period, fallbackPeriod);
  const a = finiteOr(amplitude, 1);
  if (!(a > 1)) return { a: 1, p, s: p / 4 };
  return { a, p, s: (p / (2 * Math.PI)) * Math.asin(1 / a) };
}

function easeInElastic(t: number, amplitude: number | undefined, period: number | undefined): number {
  const { a, p, s } = elasticParams(amplitude, period, DEFAULT_PERIOD);
  return -(a * Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1) - s) * (2 * Math.PI) / p));
}

function easeOutElastic(t: number, amplitude: number | undefined, period: number | undefined): number {
  const { a, p, s } = elasticParams(amplitude, period, DEFAULT_PERIOD);
  return a * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
}

function easeInOutElastic(t: number, amplitude: number | undefined, period: number | undefined): number {
  const { a, p, s } = elasticParams(amplitude, period, DEFAULT_PERIOD_INOUT);
  const t2 = t * 2;
  if (t2 < 1) {
    return -0.5 * (a * Math.pow(2, 10 * (t2 - 1)) * Math.sin(((t2 - 1) - s) * (2 * Math.PI) / p));
  }
  const t3 = t2 - 1;
  return a * Math.pow(2, -10 * t3) * Math.sin((t3 - s) * (2 * Math.PI) / p) * 0.5 + 1;
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

const easeInBounce = (t: number): number => 1 - easeOutBounce(1 - t);

const easeInOutBounce = (t: number): number => (t < 0.5
  ? (1 - easeOutBounce(1 - 2 * t)) / 2
  : (1 + easeOutBounce(2 * t - 1)) / 2);

export function ease(easing: Easing | undefined, t: number): number {
  if (!Number.isFinite(t)) return 0;
  const x = Math.min(1, Math.max(0, t));
  if (!easing) return x;

  if (x === 0) return 0;
  if (x === 1) return 1;

  const { fn, direction, amplitude, period } = easing;

  if (fn === 'back') {
    if (direction === 'in') return easeInBack(x, amplitude);
    if (direction === 'out') return easeOutBack(x, amplitude);
    return easeInOutBack(x, amplitude);
  }

  if (fn === 'elastic') {
    if (direction === 'in') return easeInElastic(x, amplitude, period);
    if (direction === 'out') return easeOutElastic(x, amplitude, period);
    return easeInOutElastic(x, amplitude, period);
  }

  if (fn === 'bounce') {
    if (direction === 'in') return easeInBounce(x);
    if (direction === 'out') return easeOutBounce(x);
    return easeInOutBounce(x);
  }

  const base = EASE_IN[fn];
  if (!base) return x;
  if (direction === 'in') return base(x);
  if (direction === 'out') return 1 - base(1 - x);
  return x < 0.5 ? base(2 * x) / 2 : 1 - base(2 - 2 * x) / 2;
}
