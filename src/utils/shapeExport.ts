import { ComponentConfig } from '../types';
import { clampShapeData, generatePath } from '../shared/utils/shapePath';

/**
 * Export-time pass: validates every shape component and bakes a pixel-space
 * SVG path string (props.shape.pathData) so the TV renders without path math.
 * Degenerate shapes are dropped. Non-shape components pass through untouched.
 */
export function bakeShapeComponents(components: ComponentConfig[]): ComponentConfig[] {
  const out: ComponentConfig[] = [];
  for (const c of components) {
    if (c.type !== 'shape') {
      out.push(c);
      continue;
    }
    const shape = clampShapeData(c.props?.shape);
    if (!shape) {
      // degenerate — drop rather than send something unrenderable
      console.warn(`Export: dropping shape component "${c.displayName || c.id}" with invalid shape data`);
      continue;
    }
    const width = Math.max(1, Math.round(c.size.width));
    const height = Math.max(1, Math.round(c.size.height));
    out.push({
      ...c,
      props: {
        ...c.props,
        shape: { ...shape, pathData: generatePath(shape.vertices, shape.closed, width, height) },
      },
    });
  }
  return out;
}
