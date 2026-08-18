import { describe, it, expect } from 'vitest';
import { sanitizeTransforms } from './transformExport';
import { ComponentConfig } from '../types';

const base = (transform?: any): ComponentConfig => ({
  id: 'c1',
  type: 'custom',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 60 },
  transform,
});

describe('sanitizeTransforms', () => {
  it('leaves untransformed components untouched', () => {
    const c = base(undefined);
    expect(sanitizeTransforms([c])[0]).toEqual(c);
  });

  it('strips an identity transform so exported JSON stays clean', () => {
    const out = sanitizeTransforms([base({ rotation: 0, scale: 1, origin: 'center' })]);
    expect(out[0].transform).toBeUndefined();
  });

  it('preserves a real transform', () => {
    const out = sanitizeTransforms([base({ rotation: 45, scale: 2, origin: 'top-left' })]);
    expect(out[0].transform).toEqual({ rotation: 45, scale: 2, origin: 'top-left' });
  });

  it('drops a non-finite rotation', () => {
    const out = sanitizeTransforms([base({ rotation: Number.NaN, scale: 2 })]);
    expect(out[0].transform).toEqual({ scale: 2 });
  });

  it('drops a zero or negative scale', () => {
    expect(sanitizeTransforms([base({ rotation: 45, scale: 0 })])[0].transform).toEqual({ rotation: 45 });
    expect(sanitizeTransforms([base({ rotation: 45, scale: -3 })])[0].transform).toEqual({ rotation: 45 });
  });

  it('drops an unknown origin', () => {
    const out = sanitizeTransforms([base({ rotation: 45, origin: 'sideways' })]);
    expect(out[0].transform).toEqual({ rotation: 45 });
  });

  it('strips the transform entirely when every field was invalid', () => {
    const out = sanitizeTransforms([base({ rotation: Number.POSITIVE_INFINITY, scale: 0 })]);
    expect(out[0].transform).toBeUndefined();
  });

  it('strips a lone invalid origin, leaving nothing to keep', () => {
    const out = sanitizeTransforms([base({ origin: 'sideways' })]);
    expect(out[0].transform).toBeUndefined();
  });

  it('preserves a lone valid origin with no rotation or scale', () => {
    const out = sanitizeTransforms([base({ origin: 'top-left' })]);
    expect(out[0].transform).toEqual({ origin: 'top-left' });
  });
});
