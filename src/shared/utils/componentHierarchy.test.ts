import { describe, it, expect } from 'vitest';
import { buildComponentTree, localOffset, effectiveOpacity } from './componentHierarchy';

interface TestComponent {
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  id: string;
  parentId?: string;
}

const comp = (id: string, overrides: Partial<TestComponent> = {}): TestComponent => ({
  type: 'shape',
  position: { x: 0, y: 0 },
  size: { width: 10, height: 10 },
  id,
  ...overrides,
});

describe('buildComponentTree', () => {
  it('returns a flat forest of roots when nothing has a parentId', () => {
    const components = [comp('a'), comp('b'), comp('c')];
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['a', 'b', 'c']);
    tree.forEach(n => expect(n.children).toEqual([]));
  });

  it('nests one level of children under their parent', () => {
    const components = [
      comp('parent'),
      comp('child1', { parentId: 'parent' }),
      comp('child2', { parentId: 'parent' }),
    ];
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['parent']);
    expect(tree[0].children.map(n => n.component.id)).toEqual(['child1', 'child2']);
  });

  it('nests three levels deep', () => {
    const components = [
      comp('grandparent'),
      comp('parent', { parentId: 'grandparent' }),
      comp('child', { parentId: 'parent' }),
    ];
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['grandparent']);
    expect(tree[0].children.map(n => n.component.id)).toEqual(['parent']);
    expect(tree[0].children[0].children.map(n => n.component.id)).toEqual(['child']);
  });

  it('treats a component whose parentId points at nothing as a root', () => {
    const components = [comp('orphan', { parentId: 'does-not-exist' })];
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['orphan']);
    expect(tree[0].children).toEqual([]);
  });

  it('does not infinite-loop or throw on a two-node cycle, and treats both as roots', () => {
    const components = [
      comp('a', { parentId: 'b' }),
      comp('b', { parentId: 'a' }),
    ];
    expect(() => buildComponentTree(components)).not.toThrow();
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id).sort()).toEqual(['a', 'b']);
    tree.forEach(n => expect(n.children).toEqual([]));
  });

  it('does not infinite-loop or throw on a self-parent, and treats it as a root', () => {
    const components = [comp('a', { parentId: 'a' })];
    expect(() => buildComponentTree(components)).not.toThrow();
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['a']);
    expect(tree[0].children).toEqual([]);
  });

  it('preserves relative ordering of siblings within a subtree', () => {
    const components = [
      comp('parent'),
      comp('z', { parentId: 'parent' }),
      comp('m', { parentId: 'parent' }),
      comp('a', { parentId: 'parent' }),
    ];
    const tree = buildComponentTree(components);
    expect(tree[0].children.map(n => n.component.id)).toEqual(['z', 'm', 'a']);
  });

  it('preserves relative ordering of root-level components as given', () => {
    const components = [comp('z'), comp('m'), comp('a')];
    const tree = buildComponentTree(components);
    expect(tree.map(n => n.component.id)).toEqual(['z', 'm', 'a']);
  });
});

describe('localOffset', () => {
  it('offsets the child position against the parent AUTHORED position, not the effective one', () => {
    const childEffectivePosition = { x: 150, y: 220 };
    const parentAuthoredPosition = { x: 100, y: 200 };
    expect(localOffset(childEffectivePosition, parentAuthoredPosition)).toEqual({ x: 50, y: 20 });
  });

  it('remains stable regardless of where the parent has animated to', () => {
    const childEffectivePosition = { x: 150, y: 220 };
    const parentAuthoredPosition = { x: 100, y: 200 };
    const offsetWhileParentAtRest = localOffset(childEffectivePosition, parentAuthoredPosition);
    const offsetWhileParentAnimatedElsewhere = localOffset(childEffectivePosition, parentAuthoredPosition);
    expect(offsetWhileParentAnimatedElsewhere).toEqual(offsetWhileParentAtRest);
  });
});

describe('effectiveOpacity', () => {
  it('returns 1 for an empty chain', () => {
    expect(effectiveOpacity([])).toBe(1);
  });

  it('treats an absent opacity as 1', () => {
    expect(effectiveOpacity([undefined])).toBe(1);
    expect(effectiveOpacity([undefined, undefined])).toBe(1);
  });

  it('multiplies opacities down three levels', () => {
    expect(effectiveOpacity([0.5, 0.5, 0.5])).toBeCloseTo(0.125, 10);
  });

  it('mixes defined and absent opacities, treating absent as 1', () => {
    expect(effectiveOpacity([0.5, undefined, 0.4])).toBeCloseTo(0.2, 10);
  });
});
