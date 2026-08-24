import type { OverlayConfig } from '../shared/utils/overlayTimeline';
import { validateOverlay } from '../shared/utils/overlayValidation';
import { uniqueOverlayId } from './overlayStorage';

export type OverlayImportMode = 'copy' | 'replace';

export type OverlayImportResult =
  | { ok: true; overlay: OverlayConfig; collided: boolean; originalId: string }
  | { ok: false; error: string };

export function parseOverlayImport(
  text: string,
  existingIds: Set<string>,
  mode: OverlayImportMode = 'copy',
): OverlayImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Nothing to import — paste overlay JSON or choose a file.' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }

  if (raw && typeof raw === 'object' && Array.isArray((raw as { components?: unknown }).components) === false
      && Array.isArray((raw as { presets?: unknown }).presets)) {
    return {
      ok: false,
      error: 'That looks like a full layout-builder bundle. Use Restore in the preset manager instead.',
    };
  }

  const validated = validateOverlay(raw);
  if (!validated) {
    return {
      ok: false,
      error: 'Not a valid overlay — needs id, name, dimensions, fps, start/end frame and at least one component.',
    };
  }

  const originalId = validated.id;
  const collided = existingIds.has(originalId);

  if (collided && mode === 'copy') {
    return {
      ok: true,
      collided,
      originalId,
      overlay: { ...validated, id: uniqueOverlayId(originalId, existingIds) },
    };
  }

  return { ok: true, collided, originalId, overlay: validated };
}
