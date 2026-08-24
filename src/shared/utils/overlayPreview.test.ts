import { describe, it, expect } from 'vitest';
import { composePreview } from './overlayPreview';
import type { SampledValues } from './overlayTimeline';
import type { ComponentTransform } from './componentTransform';

function sampled(overrides: Partial<SampledValues> = {}): SampledValues {
  return { ...overrides };
}

const SIZE = { width: 100, height: 50 };

describe('composePreview', () => {
  it('returns authored values unchanged when sampled is undefined', () => {
    const position = { x: 10, y: 20 };
    const transform: ComponentTransform = { rotation: 5, scale: 2, origin: 'top-left' };
    const result = composePreview(position, SIZE, transform, undefined);

    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.transform).toBe(transform);
    expect(result.opacity).toBe(1);
    expect(result.color).toBeUndefined();
    expect(result.backgroundColor).toBeUndefined();
  });

  it('returns the same undefined transform reference when sampled is undefined and authored transform is undefined', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, undefined);
    expect(result.transform).toBe(undefined);
  });

  it('uses the sampled absolute x/y when those channels have a track', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5, y: -3 }));
    expect(result.position).toEqual({ x: 5, y: -3 });
  });

  it('falls back to the authored position for a channel with no track', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5 }));
    expect(result.position).toEqual({ x: 5, y: 20 });
  });

  it('uses the sampled absolute rotation when present', () => {
    const transform: ComponentTransform = { rotation: 30 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ rotation: 15 }));
    expect(result.transform?.rotation).toBe(15);
  });

  it('falls back to authored rotation, treated as 0 when absent, when the channel has no track', () => {
    const transform: ComponentTransform = { scale: 2 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ x: 1 }));
    expect(result.transform?.rotation).toBe(0);
  });

  it('replaces scale with the sampled absolute value rather than multiplying', () => {
    const transform: ComponentTransform = { scale: 2 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ scale: 3 }));
    expect(result.transform?.scale).toBe(3);
  });

  it('falls back to authored scale, treated as 1 when absent, when the channel has no track', () => {
    const transform: ComponentTransform = { rotation: 10 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ rotation: 20 }));
    expect(result.transform?.scale).toBe(1);
  });

  it('preserves the authored origin untouched', () => {
    const transform: ComponentTransform = { rotation: 0, scale: 1, origin: 'bottom-right' };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ rotation: 45 }));
    expect(result.transform?.origin).toBe('bottom-right');
  });

  it('floors composed scale at 0.01', () => {
    const transform: ComponentTransform = { scale: 1 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ scale: 0 }));
    expect(result.transform?.scale).toBe(0.01);
  });

  it('clamps opacity above 1', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ opacity: 1.5 }));
    expect(result.opacity).toBe(1);
  });

  it('clamps opacity below 0', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ opacity: -0.5 }));
    expect(result.opacity).toBe(0);
  });

  it('treats absent opacity as fully opaque', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ x: 1 }));
    expect(result.opacity).toBe(1);
  });

  it('passes through color and backgroundColor when present in sampled', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE,
      undefined,
      sampled({ color: '#ff0000', backgroundColor: '#00ff00' }),
    );
    expect(result.color).toBe('#ff0000');
    expect(result.backgroundColor).toBe('#00ff00');
  });

  it('omits color and backgroundColor when absent from sampled', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled());
    expect(result.color).toBeUndefined();
    expect(result.backgroundColor).toBeUndefined();
  });

  it('gains a rotation from animation when authored transform is undefined', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ rotation: 20 }));
    expect(result.transform).toEqual({ rotation: 20, scale: 1 });
  });

  it('degrades a NaN sampled x to the authored position', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: NaN }));
    expect(Number.isFinite(result.position.x)).toBe(true);
    expect(result.position.x).toBe(10);
  });

  it('degrades a NaN sampled y to the authored position', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ y: NaN }));
    expect(Number.isFinite(result.position.y)).toBe(true);
    expect(result.position.y).toBe(20);
  });

  it('degrades a NaN sampled rotation to the authored rotation', () => {
    const transform: ComponentTransform = { rotation: 30 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ rotation: NaN }));
    expect(Number.isFinite(result.transform?.rotation)).toBe(true);
    expect(result.transform?.rotation).toBe(30);
  });

  it('degrades a NaN sampled scale to the authored scale', () => {
    const transform: ComponentTransform = { scale: 2 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ scale: NaN }));
    expect(Number.isFinite(result.transform?.scale)).toBe(true);
    expect(result.transform?.scale).toBe(2);
  });

  it('degrades a NaN sampled opacity to fully opaque', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ opacity: NaN }));
    expect(Number.isFinite(result.opacity)).toBe(true);
    expect(result.opacity).toBe(1);
  });

  it('degrades an Infinity sampled scale to the authored scale', () => {
    const transform: ComponentTransform = { scale: 2 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ scale: Infinity }));
    expect(Number.isFinite(result.transform?.scale)).toBe(true);
    expect(result.transform?.scale).toBe(2);
  });

  it('still floors a legitimately small finite scale at 0.01', () => {
    const transform: ComponentTransform = { scale: 1 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ scale: 0.001 }));
    expect(result.transform?.scale).toBe(0.01);
  });

  it('falls back to authored x when the x channel is marked dirty even though a sampled value exists', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5, y: -3 }), new Set(['x']));
    expect(result.position).toEqual({ x: 10, y: -3 });
  });

  it('still uses the sampled value for a channel that is not marked dirty', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5, y: -3 }), new Set(['x']));
    expect(result.position.y).toBe(-3);
  });

  it('falls back to authored rotation and scale when those channels are dirty', () => {
    const transform: ComponentTransform = { rotation: 30, scale: 2 };
    const result = composePreview({ x: 0, y: 0 }, SIZE, transform, sampled({ rotation: 15, scale: 3 }), new Set(['rotation', 'scale']));
    expect(result.transform?.rotation).toBe(30);
    expect(result.transform?.scale).toBe(2);
  });

  it('behaves exactly as before when no dirty set is passed', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5 }));
    expect(result.position).toEqual({ x: 5, y: 20 });
  });

  it('behaves exactly as before when an empty dirty set is passed', () => {
    const result = composePreview({ x: 10, y: 20 }, SIZE, undefined, sampled({ x: 5 }), new Set());
    expect(result.position).toEqual({ x: 5, y: 20 });
  });
});

describe('composePreview width/height', () => {
  it('returns the authored size and no stretch when nothing is sampled', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, undefined);
    expect(result.size).toEqual(SIZE);
    expect(result.stretch).toEqual({ x: 1, y: 1 });
  });

  it('falls back to the authored size per axis', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ width: 200 }));
    expect(result.size).toEqual({ width: 200, height: 50 });
    expect(result.stretch).toEqual({ x: 2, y: 1 });
  });

  it('derives a per-axis stretch from sampled size', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ width: 50, height: 100 }));
    expect(result.stretch).toEqual({ x: 0.5, y: 2 });
  });

  it('allows a zero size (fully collapsed) without going negative', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ width: -40 }));
    expect(result.size.width).toBe(0);
    expect(result.stretch.x).toBe(0);
  });

  it('ignores a NaN sampled size and keeps the authored value', () => {
    const result = composePreview({ x: 0, y: 0 }, SIZE, undefined, sampled({ width: NaN }));
    expect(result.size.width).toBe(100);
    expect(result.stretch.x).toBe(1);
  });

  it('treats a zero authored size as stretch 1 rather than dividing by zero', () => {
    const result = composePreview(
      { x: 0, y: 0 },
      { width: 0, height: 0 },
      undefined,
      sampled({ width: 80, height: 40 }),
    );
    expect(result.stretch).toEqual({ x: 1, y: 1 });
    expect(result.size).toEqual({ width: 80, height: 40 });
  });

  it('lets a live resize win over the sampled size via dirty channels', () => {
    const result = composePreview(
      { x: 0, y: 0 },
      SIZE,
      undefined,
      sampled({ width: 999, height: 999 }),
      new Set(['width', 'height'] as const),
    );
    expect(result.size).toEqual(SIZE);
    expect(result.stretch).toEqual({ x: 1, y: 1 });
  });
});
