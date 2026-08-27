import type { ComponentConfig } from '../types';

export interface CollectedComponents {
  rootIds: string[];
  collected: ComponentConfig[];
}

export function collectWithDescendants(
  components: ComponentConfig[],
  ids: string[],
): CollectedComponents {
  const byId = new Map(components.map(c => [c.id, c]));

  const isDescendantOf = (componentId: string, ancestorId: string): boolean => {
    const seen = new Set<string>();
    let current = byId.get(componentId)?.parentId;
    while (current && !seen.has(current)) {
      if (current === ancestorId) return true;
      seen.add(current);
      current = byId.get(current)?.parentId;
    }
    return false;
  };

  const rootIds = ids.filter(id =>
    byId.has(id) && !ids.some(otherId => otherId !== id && isDescendantOf(id, otherId)),
  );

  const collected: ComponentConfig[] = [];
  const added = new Set<string>();

  const addSubtree = (id: string) => {
    if (added.has(id)) return;
    const component = byId.get(id);
    if (!component) return;
    added.add(id);
    collected.push(component);
    for (const child of components) {
      if (child.parentId === id) addSubtree(child.id);
    }
  };

  for (const id of rootIds) addSubtree(id);

  return { rootIds, collected };
}
