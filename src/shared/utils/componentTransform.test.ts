import { describe, it, expect } from 'vitest';
import {
  isIdentityTransform,
  isDefaultTransform,
  resolveOrigin,
  buildNativeTransform,
  buildCssTransform,
  buildCssTransformOrigin,
} from './componentTransform';

describe('isIdentityTransform', () => {
  it('treats undefined as identity', () => {
    expect(isIdentityTransform(undefined)).toBe(true);
  });

  it('treats an empty object as identity', () => {
    expect(isIdentityTransform({})).toBe(true);
  });

  it('treats explicit defaults as identity', () => {
    expect(isIdentityTransform({ rotation: 0, scale: 1, origin: 'center' })).toBe(true);
  });

  it('is not identity when rotated', () => {
    expect(isIdentityTransform({ rotation: 15 })).toBe(false);
  });

  it('is not identity when scaled', () => {
    expect(isIdentityTransform({ scale: 1.5 })).toBe(false);
  });

  it('is identity when only the origin differs but nothing transforms', () => {
    expect(isIdentityTransform({ origin: 'top-left' })).toBe(true);
  });
});

describe('isDefaultTransform', () => {
  it('treats undefined as default', () => {
    expect(isDefaultTransform(undefined)).toBe(true);
  });

  it('treats an empty object as default', () => {
    expect(isDefaultTransform({})).toBe(true);
  });

  it('treats explicit defaults as default', () => {
    expect(isDefaultTransform({ rotation: 0, scale: 1, origin: 'center' })).toBe(true);
  });

  it('is not default when a lone non-center origin is set', () => {
    expect(isDefaultTransform({ origin: 'top-left' })).toBe(false);
  });

  it('is not default when rotated', () => {
    expect(isDefaultTransform({ rotation: 15 })).toBe(false);
  });

  it('is not default when scaled', () => {
    expect(isDefaultTransform({ scale: 2 })).toBe(false);
  });
});

describe('resolveOrigin', () => {
  it('defaults to center', () => {
    expect(resolveOrigin(undefined, 100, 60)).toEqual({ x: 50, y: 30 });
  });

  it('resolves each named origin to pixels from the top-left', () => {
    expect(resolveOrigin('top-left', 100, 60)).toEqual({ x: 0, y: 0 });
    expect(resolveOrigin('top', 100, 60)).toEqual({ x: 50, y: 0 });
    expect(resolveOrigin('top-right', 100, 60)).toEqual({ x: 100, y: 0 });
    expect(resolveOrigin('left', 100, 60)).toEqual({ x: 0, y: 30 });
    expect(resolveOrigin('center', 100, 60)).toEqual({ x: 50, y: 30 });
    expect(resolveOrigin('right', 100, 60)).toEqual({ x: 100, y: 30 });
    expect(resolveOrigin('bottom-left', 100, 60)).toEqual({ x: 0, y: 60 });
    expect(resolveOrigin('bottom', 100, 60)).toEqual({ x: 50, y: 60 });
    expect(resolveOrigin('bottom-right', 100, 60)).toEqual({ x: 100, y: 60 });
  });
});

describe('buildNativeTransform', () => {
  it('returns undefined for an identity transform', () => {
    expect(buildNativeTransform(undefined, 100, 60)).toBeUndefined();
    expect(buildNativeTransform({ rotation: 0, scale: 1 }, 100, 60)).toBeUndefined();
  });

  it('emits rotate and scale with no translation for a center origin', () => {
    expect(buildNativeTransform({ rotation: 45, scale: 2 }, 100, 60)).toEqual([
      { rotate: '45deg' },
      { scale: 2 },
    ]);
  });

  it('brackets the transform with translations for an off-center origin', () => {
    expect(buildNativeTransform({ rotation: 90, origin: 'top-left' }, 100, 60)).toEqual([
      { translateX: -50 },
      { translateY: -30 },
      { rotate: '90deg' },
      { scale: 1 },
      { translateX: 50 },
      { translateY: 30 },
    ]);
  });

  it('omits scale entries when only rotating from center', () => {
    expect(buildNativeTransform({ rotation: 10 }, 40, 40)).toEqual([
      { rotate: '10deg' },
      { scale: 1 },
    ]);
  });
});

describe('buildCssTransform', () => {
  it('returns undefined for an identity transform', () => {
    expect(buildCssTransform(undefined)).toBeUndefined();
    expect(buildCssTransform({ rotation: 0, scale: 1 })).toBeUndefined();
  });

  it('emits rotate then scale', () => {
    expect(buildCssTransform({ rotation: 45, scale: 2 })).toBe('rotate(45deg) scale(2)');
  });
});

describe('buildCssTransformOrigin', () => {
  it('returns undefined for an identity transform', () => {
    expect(buildCssTransformOrigin(undefined, 100, 60)).toBeUndefined();
  });

  it('emits pixel offsets for a transforming component', () => {
    expect(buildCssTransformOrigin({ rotation: 45, origin: 'top-left' }, 100, 60)).toBe('0px 0px');
    expect(buildCssTransformOrigin({ rotation: 45 }, 100, 60)).toBe('50px 30px');
  });
});
