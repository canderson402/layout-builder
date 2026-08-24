import { describe, it, expect, beforeEach } from 'vitest';
import {
  listOverlays,
  saveOverlay,
  loadOverlay,
  deleteOverlay,
  newOverlay,
  OVERLAY_STORAGE_KEY,
  type SavedOverlay,
} from './overlayStorage';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';

class LocalStorageStub {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

(globalThis as { localStorage?: LocalStorageStub }).localStorage = new LocalStorageStub();

beforeEach(() => {
  (globalThis.localStorage as LocalStorageStub).clear();
});

function makeOverlay(overrides: Partial<OverlayConfig> = {}): OverlayConfig {
  return {
    id: 'overlay_test',
    name: 'Test Overlay',
    components: [],
    dimensions: { width: 1920, height: 1080 },
    fps: 30,
    startFrame: 0,
    endFrame: 90,
    tracks: [],
    ...overrides,
  };
}

describe('overlayStorage', () => {
  describe('round trip', () => {
    it('saves, lists, and loads an overlay', () => {
      const overlay = makeOverlay();
      const saved = saveOverlay(overlay, '2026-08-18T00:00:00.000Z');

      expect(listOverlays()).toEqual([saved]);
      expect(loadOverlay(saved.id)).toEqual(saved);
    });

    it('stores under OVERLAY_STORAGE_KEY', () => {
      const overlay = makeOverlay();
      saveOverlay(overlay, '2026-08-18T00:00:00.000Z');

      const raw = globalThis.localStorage.getItem(OVERLAY_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as SavedOverlay[];
      expect(parsed).toHaveLength(1);
    });
  });

  describe('saveOverlay overwrite-by-id', () => {
    it('preserves id and createdAt while advancing updatedAt', () => {
      const overlay = makeOverlay({ id: 'overlay_a', name: 'My Overlay' });
      const first = saveOverlay(overlay, '2026-08-18T00:00:00.000Z');

      const updatedOverlay = makeOverlay({
        id: 'overlay_a',
        name: 'My Overlay',
        endFrame: 120,
      });
      const second = saveOverlay(updatedOverlay, '2026-08-18T01:00:00.000Z');

      expect(second.id).toBe(first.id);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).toBe('2026-08-18T01:00:00.000Z');
      expect(second.overlay.endFrame).toBe(120);

      const all = listOverlays();
      expect(all).toHaveLength(1);
    });

    it('does not create a duplicate entry on same-id save', () => {
      saveOverlay(makeOverlay({ id: 'overlay_dup', name: 'Dup' }), '2026-08-18T00:00:00.000Z');
      saveOverlay(makeOverlay({ id: 'overlay_dup', name: 'Dup' }), '2026-08-18T00:01:00.000Z');

      expect(listOverlays()).toHaveLength(1);
    });

    it('keeps two overlays with the same name but different ids as separate records', () => {
      const first = saveOverlay(makeOverlay({ id: 'overlay_1', name: 'Same Name' }), '2026-08-18T00:00:00.000Z');
      const second = saveOverlay(makeOverlay({ id: 'overlay_2', name: 'Same Name' }), '2026-08-18T00:01:00.000Z');

      const all = listOverlays();
      expect(all).toHaveLength(2);
      expect(all.map(o => o.id).sort()).toEqual(['overlay_1', 'overlay_2']);
      expect(first.id).toBe('overlay_1');
      expect(second.id).toBe('overlay_2');
    });
  });

  describe('listOverlays robustness', () => {
    it('returns [] when the key is missing', () => {
      expect(listOverlays()).toEqual([]);
    });

    it('returns [] for malformed JSON', () => {
      globalThis.localStorage.setItem(OVERLAY_STORAGE_KEY, '{not json');
      expect(listOverlays()).toEqual([]);
    });

    it('returns [] when the stored value is not an array', () => {
      globalThis.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
      expect(listOverlays()).toEqual([]);
    });
  });

  describe('legacy durationFrames migration', () => {
    it('derives startFrame/endFrame from a legacy durationFrames field on load', () => {
      const legacy = {
        id: 'overlay_legacy',
        name: 'Legacy Overlay',
        overlay: {
          id: 'overlay_legacy',
          name: 'Legacy Overlay',
          components: [],
          dimensions: { width: 1920, height: 1080 },
          fps: 30,
          durationFrames: 90,
          tracks: [],
        },
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      };
      globalThis.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify([legacy]));

      const [loaded] = listOverlays();
      expect(loaded.overlay.startFrame).toBe(0);
      expect(loaded.overlay.endFrame).toBe(90);

      const byId = loadOverlay('overlay_legacy');
      expect(byId?.overlay.startFrame).toBe(0);
      expect(byId?.overlay.endFrame).toBe(90);
    });
  });

  describe('deleteOverlay', () => {
    it('deletes an existing overlay', () => {
      const saved = saveOverlay(makeOverlay(), '2026-08-18T00:00:00.000Z');
      deleteOverlay(saved.id);
      expect(listOverlays()).toEqual([]);
    });

    it('is a no-op when the id does not exist', () => {
      const saved = saveOverlay(makeOverlay(), '2026-08-18T00:00:00.000Z');
      expect(() => deleteOverlay('does-not-exist')).not.toThrow();
      expect(listOverlays()).toEqual([saved]);
    });
  });

  describe('newOverlay', () => {
    it('applies defaults', () => {
      const overlay = newOverlay('My Overlay', { width: 1920, height: 1080 });

      expect(overlay.name).toBe('My Overlay');
      expect(overlay.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(overlay.fps).toBe(30);
      expect(overlay.startFrame).toBe(0);
      expect(overlay.endFrame).toBe(90);
      expect(overlay.components).toEqual([]);
      expect(overlay.tracks).toEqual([]);
      expect(overlay.backgroundColor).toBeUndefined();
      expect(overlay.id).toMatch(/^overlay_my-overlay/);
    });

    it('generates deterministic, unique ids when names collide', () => {
      const first = newOverlay('Lower Third', { width: 1920, height: 1080 });
      saveOverlay(first, '2026-08-18T00:00:00.000Z');

      const second = newOverlay('Lower Third', { width: 1920, height: 1080 });

      expect(second.id).not.toBe(first.id);
      expect(second.id).toMatch(/^overlay_lower-third/);
    });

    it('is deterministic given the same existing ids', () => {
      const first = newOverlay('Ticker', { width: 100, height: 100 });
      saveOverlay(first, '2026-08-18T00:00:00.000Z');
      const second = newOverlay('Ticker', { width: 100, height: 100 });

      const third = newOverlay('Ticker', { width: 100, height: 100 });
      expect(third.id).toBe(second.id);
    });
  });
});
