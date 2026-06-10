import { ComponentConfig } from '../types';

/**
 * A multi-state parent has no size or styling of its own — it's a pure
 * logic container. Its canvas footprint is the bounding box of every sized
 * descendant (across ALL states, so the region stays stable while states
 * switch). Returns null when it has no sized descendants yet.
 */
export function getMultiStateBounds(
  parent: ComponentConfig,
  components: ComponentConfig[],
): { x: number; y: number; width: number; height: number } | null {
  const ids = collectDescendantIds(parent.id, components);

  const rects = components.filter(c =>
    ids.has(c.id) &&
    c.type !== 'group' && c.type !== 'multiState' &&
    (c.size.width > 0 || c.size.height > 0)
  );
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map(c => c.position.x));
  const minY = Math.min(...rects.map(c => c.position.y));
  const maxX = Math.max(...rects.map(c => c.position.x + c.size.width));
  const maxY = Math.max(...rects.map(c => c.position.y + c.size.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Every descendant id of a component (children, grandchildren, ...). */
export function collectDescendantIds(
  rootId: string,
  components: ComponentConfig[],
): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of components) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  ids.delete(rootId);
  return ids;
}

/** Fallback footprint so an empty multi-state container stays clickable. */
export const EMPTY_MULTISTATE_SIZE = { width: 240, height: 120 };
