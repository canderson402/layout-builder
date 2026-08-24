import type { OverlayConfig } from '../shared/utils/overlayTimeline';

export interface SavedOverlay {
  id: string;
  name: string;
  overlay: OverlayConfig;
  createdAt: string;
  updatedAt: string;
}

export const OVERLAY_STORAGE_KEY = 'sv-overlay-documents';

function readArray(key: string): unknown[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeOverlay(overlay: OverlayConfig): OverlayConfig {
  if (overlay.startFrame !== undefined && overlay.endFrame !== undefined) {
    return overlay;
  }
  const legacyDurationFrames = (overlay as unknown as { durationFrames?: number }).durationFrames;
  return {
    ...overlay,
    startFrame: overlay.startFrame ?? 0,
    endFrame: overlay.endFrame ?? (typeof legacyDurationFrames === 'number' ? legacyDurationFrames : 90),
  };
}

function normalizeSavedOverlay(saved: SavedOverlay): SavedOverlay {
  return { ...saved, overlay: normalizeOverlay(saved.overlay) };
}

export function listOverlays(): SavedOverlay[] {
  return (readArray(OVERLAY_STORAGE_KEY) as SavedOverlay[]).map(normalizeSavedOverlay);
}

function writeOverlays(overlays: SavedOverlay[]): void {
  localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlays));
}

export function saveOverlay(overlay: OverlayConfig, now: string): SavedOverlay {
  const existing = listOverlays();
  const existingIndex = existing.findIndex(o => o.id === overlay.id);

  const saved: SavedOverlay = {
    id: overlay.id,
    name: overlay.name,
    overlay,
    createdAt: existingIndex >= 0 ? existing[existingIndex].createdAt : now,
    updatedAt: now,
  };

  let updated: SavedOverlay[];
  if (existingIndex >= 0) {
    updated = [...existing];
    updated[existingIndex] = saved;
  } else {
    updated = [...existing, saved];
  }

  writeOverlays(updated);
  return saved;
}

export function loadOverlay(id: string): SavedOverlay | undefined {
  return listOverlays().find(o => o.id === id);
}

export function deleteOverlay(id: string): void {
  const existing = listOverlays();
  writeOverlays(existing.filter(o => o.id !== id));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'overlay';
}

export function uniqueOverlayId(preferred: string, existingIds: Set<string>): string {
  const stem = preferred.startsWith('overlay_') ? preferred.slice('overlay_'.length) : preferred;
  const base = `overlay_${slugify(stem)}`;
  if (!existingIds.has(base)) return base;
  let counter = 2;
  while (existingIds.has(`${base}_${counter}`)) {
    counter += 1;
  }
  return `${base}_${counter}`;
}

export function overlayIds(): Set<string> {
  return new Set(listOverlays().map(o => o.id));
}

export function newOverlay(name: string, dimensions: { width: number; height: number }): OverlayConfig {
  const id = uniqueOverlayId(name, overlayIds());

  return {
    id,
    name,
    components: [],
    dimensions,
    backgroundColor: undefined,
    fps: 30,
    startFrame: 0,
    endFrame: 90,
    tracks: [],
  };
}
