import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseOverlayImport } from './overlayImport';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const valid = {
  id: 'overlay_cody',
  name: 'Cody Burst',
  dimensions: { width: 1920, height: 1080 },
  fps: 30,
  startFrame: 0,
  endFrame: 60,
  components: [
    { id: 'c1', type: 'custom', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
  ],
  tracks: [],
};

const json = (o: unknown) => JSON.stringify(o);

describe('parseOverlayImport', () => {
  it('accepts a valid exported overlay', () => {
    const result = parseOverlayImport(json(valid), new Set());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.overlay.id).toBe('overlay_cody');
      expect(result.overlay.name).toBe('Cody Burst');
      expect(result.collided).toBe(false);
    }
  });

  it('rejects empty input with a usable message', () => {
    const result = parseOverlayImport('   ', new Set());
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Nothing to import') });
  });

  it('rejects malformed JSON', () => {
    const result = parseOverlayImport('{ not json', new Set());
    expect(result).toEqual({ ok: false, error: 'Not valid JSON.' });
  });

  it('rejects an overlay missing required fields', () => {
    const result = parseOverlayImport(json({ ...valid, fps: undefined }), new Set());
    expect(result.ok).toBe(false);
  });

  it('rejects an overlay with no components', () => {
    const result = parseOverlayImport(json({ ...valid, components: [] }), new Set());
    expect(result.ok).toBe(false);
  });

  it('points a full bundle at the preset manager instead', () => {
    const bundle = { version: 2, presets: [], slotTemplates: [], overlays: [] };
    const result = parseOverlayImport(json(bundle), new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bundle');
  });

  it('renames on id collision in copy mode so existing work is never clobbered', () => {
    const result = parseOverlayImport(json(valid), new Set(['overlay_cody']), 'copy');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.collided).toBe(true);
      expect(result.originalId).toBe('overlay_cody');
      expect(result.overlay.id).toBe('overlay_cody_2');
    }
  });

  it('keeps the id in replace mode so the existing overlay is overwritten deliberately', () => {
    const result = parseOverlayImport(json(valid), new Set(['overlay_cody']), 'replace');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.collided).toBe(true);
      expect(result.overlay.id).toBe('overlay_cody');
    }
  });

  it('skips past taken suffixes when renaming', () => {
    const taken = new Set(['overlay_cody', 'overlay_cody_2', 'overlay_cody_3']);
    const result = parseOverlayImport(json(valid), taken, 'copy');
    if (result.ok) expect(result.overlay.id).toBe('overlay_cody_4');
  });
});
