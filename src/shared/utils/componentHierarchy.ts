export interface HierarchyComponent {
  id?: string;
  parentId?: string;
}

export interface ComponentTreeNode<T extends HierarchyComponent = HierarchyComponent> {
  component: T;
  children: ComponentTreeNode<T>[];
}

export interface Point2D {
  x: number;
  y: number;
}

function hasCycleOrMissingAncestor(startId: string, byId: Map<string, HierarchyComponent>): boolean {
  const visited = new Set<string>([startId]);
  let currentId: string | undefined = byId.get(startId)?.parentId;
  const maxSteps = byId.size + 1;
  for (let step = 0; step < maxSteps; step++) {
    if (currentId === undefined) return false;
    if (!byId.has(currentId)) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)!.parentId;
  }
  return true;
}

export function buildComponentTree<T extends HierarchyComponent>(components: T[]): ComponentTreeNode<T>[] {
  const idOf = (c: T, index: number): string => (c.id !== undefined ? c.id : `__no-id-${index}`);

  const byId = new Map<string, T>();
  components.forEach((c, index) => byId.set(idOf(c, index), c));

  const nodeById = new Map<string, ComponentTreeNode<T>>();
  components.forEach((c, index) => nodeById.set(idOf(c, index), { component: c, children: [] }));

  const roots: ComponentTreeNode<T>[] = [];

  components.forEach((c, index) => {
    const id = idOf(c, index);
    const node = nodeById.get(id)!;
    const parentId = c.parentId;
    const isSelfParent = parentId === id;
    const isValidParent =
      parentId !== undefined &&
      !isSelfParent &&
      byId.has(parentId) &&
      !hasCycleOrMissingAncestor(id, byId);

    if (isValidParent) {
      nodeById.get(parentId!)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function localOffset(
  childEffectivePosition: Point2D,
  parentAuthoredPosition: Point2D,
): Point2D {
  return {
    x: childEffectivePosition.x - parentAuthoredPosition.x,
    y: childEffectivePosition.y - parentAuthoredPosition.y,
  };
}

export function effectiveOpacity(chain: Array<number | undefined>): number {
  return chain.reduce<number>((product, opacity) => product * (opacity ?? 1), 1);
}
