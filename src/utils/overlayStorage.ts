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

export const DEFAULT_OVERLAY_FPS = 25;
export const DEFAULT_OVERLAY_LENGTH_FRAMES = 50;
export const MIN_OVERLAY_FPS = 1;
export const MAX_OVERLAY_FPS = 240;
export const MIN_OVERLAY_LENGTH_FRAMES = 1;
export const MAX_OVERLAY_LENGTH_SECONDS = 60;

export function maxOverlayLengthFrames(fps: number): number {
  return Math.round(fps * MAX_OVERLAY_LENGTH_SECONDS);
}

export interface NewOverlayOptions {
  isTransition?: boolean;
  fps?: number;
  lengthFrames?: number;
}

function clampOrDefault(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function newOverlay(
  name: string,
  dimensions: { width: number; height: number },
  options: NewOverlayOptions = {},
): OverlayConfig {
  const id = uniqueOverlayId(name, overlayIds());
  const fps = clampOrDefault(options.fps, DEFAULT_OVERLAY_FPS, MIN_OVERLAY_FPS, MAX_OVERLAY_FPS);
  const lengthFrames = clampOrDefault(
    options.lengthFrames,
    DEFAULT_OVERLAY_LENGTH_FRAMES,
    MIN_OVERLAY_LENGTH_FRAMES,
    maxOverlayLengthFrames(fps),
  );

  return {
    id,
    name,
    components: [],
    dimensions,
    backgroundColor: undefined,
    fps,
    startFrame: 0,
    endFrame: lengthFrames,
    ...(options.isTransition ? { isTransition: true } : {}),
    tracks: [],
  };
}
