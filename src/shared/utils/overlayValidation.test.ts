import { describe, expect, it, vi } from 'vitest';
import { validateOverlay, validateOverlayTracks } from './overlayValidation';

function baseOverlay(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test_overlay',
    name: 'Test Overlay',
    dimensions: { width: 1920, height: 1080 },
    fps: 30,
    startFrame: 0,
    endFrame: 60,
    components: [
      { id: 'c1', type: 'custom', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
    ],
    tracks: [],
    ...overrides,
  };
}

describe('validateOverlay', () => {
  it('accepts a well-formed overlay unchanged', () => {
    const overlay = baseOverlay({
      tracks: [
        {
          componentId: 'c1',
          property: 'opacity',
          keyframes: [
            { frame: 0, value: 0, interpolation: 'linear' },
            { frame: 30, value: 1, interpolation: 'linear' },
          ],
        },
      ],
    });

    const result = validateOverlay(overlay);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test_overlay');
    expect(result!.components).toHaveLength(1);
    expect(result!.tracks).toHaveLength(1);
  });

  it('accepts nested components via parentId', () => {
    const overlay = baseOverlay({
      components: [
        { id: 'parent', type: 'custom', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
        { id: 'child', type: 'custom', parentId: 'parent', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
      ],
    });

    const result = validateOverlay(overlay);
    expect(result).not.toBeNull();
    expect(result!.components.map(c => c.id)).toEqual(['parent', 'child']);
  });

  it('rejects a non-object payload', () => {
    expect(validateOverlay(null)).toBeNull();
    expect(validateOverlay('not an overlay')).toBeNull();
    expect(validateOverlay([1, 2, 3])).toBeNull();
  });

  it('rejects an overlay missing required fields', () => {
    const { id, ...withoutId } = baseOverlay();
    expect(validateOverlay(withoutId)).toBeNull();

    const overlay = baseOverlay();
    delete (overlay as Record<string, unknown>).dimensions;
    expect(validateOverlay(overlay)).toBeNull();
  });

  it('rejects an overlay with a non-finite fps', () => {
    expect(validateOverlay(baseOverlay({ fps: Number.NaN }))).toBeNull();
    expect(validateOverlay(baseOverlay({ fps: 0 }))).toBeNull();
  });

  it('rejects an overlay where endFrame is before startFrame', () => {
    expect(validateOverlay(baseOverlay({ startFrame: 30, endFrame: 10 }))).toBeNull();
  });

  it('rejects an overlay with no valid components', () => {
    expect(validateOverlay(baseOverlay({ components: [] }))).toBeNull();
    expect(validateOverlay(baseOverlay({ components: [{ notAnId: true }] }))).toBeNull();
    expect(validateOverlay(baseOverlay({ components: 'not-an-array' }))).toBeNull();
  });

  it('drops a component with a duplicate id and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overlay = baseOverlay({
      components: [
        { id: 'c1', type: 'custom', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
        { id: 'c1', type: 'custom', position: { x: 5, y: 5 }, size: { width: 10, height: 10 } },
      ],
    });

    const result = validateOverlay(overlay);
    expect(result!.components).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps a component with an unresolvable parentId, but warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overlay = baseOverlay({
      components: [
        { id: 'c1', type: 'custom', parentId: 'ghost', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
      ],
    });

    const result = validateOverlay(overlay);
    expect(result).not.toBeNull();
    expect(result!.components[0].parentId).toBe('ghost');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid parentId'));
    warn.mockRestore();
  });

  it('treats a missing tracks array as an unanimated overlay rather than failing', () => {
    const overlay = baseOverlay();
    delete (overlay as Record<string, unknown>).tracks;
    const result = validateOverlay(overlay);
    expect(result).not.toBeNull();
    expect(result!.tracks).toEqual([]);
  });
});

describe('validateOverlayTracks', () => {
  const ids = new Set(['c1']);

  it('delegates track repair rules to the shared validateTracks and warns for each problem', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tracks = [
      { componentId: 'ghost', property: 'opacity', keyframes: [{ frame: 0, value: 0, interpolation: 'linear' }] },
      {
        componentId: 'c1',
        property: 'scale',
        keyframes: [
          { frame: 30, value: 1, interpolation: 'linear' },
          { frame: 0, value: 0, interpolation: 'linear' },
        ],
      },
    ];
    const result = validateOverlayTracks(tracks, ids);
    expect(result).toHaveLength(1);
    expect(result[0].keyframes.map(k => k.frame)).toEqual([0, 30]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropping track for missing component'));
    warn.mockRestore();
  });

  it('treats a non-array tracks input as no tracks', () => {
    expect(validateOverlayTracks(undefined, ids)).toEqual([]);
    expect(validateOverlayTracks('not-an-array', ids)).toEqual([]);
  });
});

describe('validateOverlay switchFrame', () => {
  it('preserves an authored switchFrame', () => {
    const result = validateOverlay(baseOverlay({ switchFrame: 12 }));
    expect(result!.switchFrame).toBe(12);
  });

  it('leaves switchFrame absent when the JSON has none, so the midpoint default applies', () => {
    const result = validateOverlay(baseOverlay({}));
    expect(result!.switchFrame).toBeUndefined();
  });

  it('drops a non-numeric or non-finite switchFrame rather than passing it through', () => {
    expect(validateOverlay(baseOverlay({ switchFrame: 'half' }))!.switchFrame).toBeUndefined();
    expect(validateOverlay(baseOverlay({ switchFrame: NaN }))!.switchFrame).toBeUndefined();
    expect(validateOverlay(baseOverlay({ switchFrame: Infinity }))!.switchFrame).toBeUndefined();
  });
});

describe('validateOverlay isTransition', () => {
  it('preserves the transition flag', () => {
    expect(validateOverlay(baseOverlay({ isTransition: true }))!.isTransition).toBe(true);
  });

  it('leaves it absent when the JSON has none', () => {
    expect(validateOverlay(baseOverlay({}))!.isTransition).toBeUndefined();
  });

  it('only accepts a literal true, not a truthy value', () => {
    expect(validateOverlay(baseOverlay({ isTransition: 'yes' }))!.isTransition).toBeUndefined();
    expect(validateOverlay(baseOverlay({ isTransition: 1 }))!.isTransition).toBeUndefined();
    expect(validateOverlay(baseOverlay({ isTransition: false }))!.isTransition).toBeUndefined();
  });
});
