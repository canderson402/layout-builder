import { describe, it, expect, vi } from 'vitest';
import { validateOverlayTracks, cleanOverlayForExport } from './overlayExport';
import { ComponentConfig } from '../types';
import { AnimationTrack, OverlayConfig } from '../shared/utils/overlayTimeline';

const comp = (id: string): ComponentConfig => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 60 },
});

const track = (overrides: Partial<AnimationTrack>): AnimationTrack => ({
  componentId: 'c1',
  property: 'opacity',
  keyframes: [],
  ...overrides,
});

describe('validateOverlayTracks', () => {
  it('passes a valid overlay through unchanged', () => {
    const tracks: AnimationTrack[] = [
      track({
        keyframes: [
          { frame: 0, value: 0, interpolation: 'linear' },
          { frame: 30, value: 1, interpolation: 'linear' },
        ],
      }),
    ];
    const out = validateOverlayTracks(tracks, [comp('c1')]);
    expect(out).toEqual(tracks);
  });

  it('delegates track repair rules to the shared validateTracks and warns for each problem', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tracks: AnimationTrack[] = [
      track({
        keyframes: [
          { frame: 30, value: 1, interpolation: 'linear' },
          { frame: 0, value: 0, interpolation: 'linear' },
        ],
      }),
    ];
    const out = validateOverlayTracks(tracks, [comp('c1')]);
    expect(out[0].keyframes.map(k => k.frame)).toEqual([0, 30]);
    warn.mockRestore();
  });

  it('drops a track referencing a component id not present in the overlay and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tracks: AnimationTrack[] = [
      track({
        componentId: 'ghost',
        keyframes: [{ frame: 0, value: 1, interpolation: 'linear' }],
      }),
    ];
    const out = validateOverlayTracks(tracks, [comp('c1')]);
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropping track for missing component'));
    warn.mockRestore();
  });
});

describe('cleanOverlayForExport', () => {
  it('exports a small overlay with one animated component', () => {
    const overlay: OverlayConfig = {
      id: 'overlay_test',
      name: 'Test Overlay',
      components: [comp('c1')],
      dimensions: { width: 1920, height: 1080 },
      backgroundColor: undefined,
      fps: 30,
      startFrame: 0,
      endFrame: 60,
      tracks: [
        track({
          keyframes: [
            { frame: 0, value: 0, interpolation: 'linear' },
            { frame: 30, value: 1, interpolation: 'linear' },
          ],
        }),
      ],
    };

    const out = cleanOverlayForExport(overlay);
    expect(out.id).toBe('overlay_test');
    expect(out.components).toHaveLength(1);
    expect(out.tracks).toHaveLength(1);
    expect(out.tracks[0].keyframes.map(k => k.frame)).toEqual([0, 30]);
  });

  it('drops a track for a component removed from the overlay', () => {
    const overlay: OverlayConfig = {
      id: 'overlay_test',
      name: 'Test Overlay',
      components: [comp('c1')],
      dimensions: { width: 1920, height: 1080 },
      backgroundColor: undefined,
      fps: 30,
      startFrame: 0,
      endFrame: 60,
      tracks: [
        track({
          componentId: 'deleted',
          keyframes: [{ frame: 0, value: 1, interpolation: 'linear' }],
        }),
      ],
    };

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = cleanOverlayForExport(overlay);
    expect(out.tracks).toEqual([]);
    warn.mockRestore();
  });
});
