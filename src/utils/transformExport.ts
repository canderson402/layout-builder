import { ComponentConfig } from '../types';
import { ComponentTransform, TransformOrigin, isDefaultTransform } from '../shared/utils/componentTransform';

const VALID_ORIGINS: TransformOrigin[] = [
  'center', 'top', 'bottom', 'left', 'right',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
];

export function sanitizeTransforms(components: ComponentConfig[]): ComponentConfig[] {
  return components.map(c => {
    if (!c.transform) return c;

    const cleaned: ComponentTransform = {};
    const t = c.transform as ComponentTransform;

    if (typeof t.rotation === 'number' && Number.isFinite(t.rotation)) {
      cleaned.rotation = t.rotation;
    } else if (t.rotation !== undefined) {
      console.warn(`Export: dropping invalid rotation on "${c.displayName || c.id}"`);
    }

    if (typeof t.scale === 'number' && Number.isFinite(t.scale) && t.scale > 0) {
      cleaned.scale = t.scale;
    } else if (t.scale !== undefined) {
      console.warn(`Export: dropping invalid scale on "${c.displayName || c.id}"`);
    }

    if (t.origin !== undefined) {
      if (VALID_ORIGINS.includes(t.origin)) {
        cleaned.origin = t.origin;
      } else {
        console.warn(`Export: dropping invalid origin on "${c.displayName || c.id}"`);
      }
    }

    if (isDefaultTransform(cleaned)) {
      const { transform, ...rest } = c;
      return rest as ComponentConfig;
    }

    return { ...c, transform: cleaned };
  });
}
