import { ComponentConfig } from '../types';
import { resolveSlotTemplate } from './slotTemplates';

const getNested = (obj: any, path: string): any =>
  path.split('.').reduce((current, key) => (current && current[key] !== undefined ? current[key] : null), obj);

/**
 * A slotList has no footprint of its own — it's the slots it draws. Its canvas
 * footprint is the bounding box of every slot the preview actually renders,
 * so the selection box hugs the rows instead of the container's padded frame.
 *
 * Mirrors WebPreview's slotList branch (dynamic slot count, hideInactiveSlots,
 * native slot pitch) so the box always matches what's on screen. Returns null
 * when no template resolves — the placeholder box uses `component.size` then.
 */
export function getSlotListBounds(
  component: ComponentConfig,
  gameData?: any,
): { x: number; y: number; width: number; height: number } | null {
  if (component.type !== 'slotList') return null;

  const props = component.props || {};
  const template = resolveSlotTemplate(props, gameData);
  if (!template) return null;

  const drawn = template.components.filter(c => c.type !== 'group');
  if (drawn.length === 0) return null;

  const staticSlotCount = props.slotCount || 5;
  const slotSpacing = props.slotSpacing ?? 5;
  const direction = props.direction || 'vertical';
  const teamLabel = props.team || 'home';
  const prefix = props.dataPathPrefix || 'leaderboardSlots';
  const hideInactiveSlots = props.hideInactiveSlots || false;

  let slotCount = staticSlotCount;
  if (props.slotCountPath) {
    const dyn = getNested(gameData, props.slotCountPath);
    if (typeof dyn === 'number' && Number.isFinite(dyn)) {
      slotCount = Math.max(1, Math.min(staticSlotCount, Math.floor(dyn)));
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let visibleSlotIndex = 0;

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    if (hideInactiveSlots) {
      const slotData = getNested(gameData, `${prefix}.${teamLabel}.slot${slotIndex}`);
      if (!slotData?.active) continue;
    }

    const offsetX = direction === 'horizontal' ? visibleSlotIndex * (template.slotSize.width + slotSpacing) : 0;
    const offsetY = direction === 'vertical' ? visibleSlotIndex * (template.slotSize.height + slotSpacing) : 0;
    visibleSlotIndex++;

    drawn.forEach(c => {
      minX = Math.min(minX, c.position.x + offsetX);
      minY = Math.min(minY, c.position.y + offsetY);
      maxX = Math.max(maxX, c.position.x + offsetX + c.size.width);
      maxY = Math.max(maxY, c.position.y + offsetY + c.size.height);
    });
  }

  if (!Number.isFinite(minX)) return null;

  return {
    x: component.position.x + minX,
    y: component.position.y + minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
