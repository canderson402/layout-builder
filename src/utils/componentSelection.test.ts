import { describe, it, expect } from 'vitest';
import type { ComponentConfig } from '../types';
import { collectWithDescendants } from './componentSelection';

const comp = (id: string, parentId?: string): ComponentConfig => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  size: { width: 10, height: 10 },
  ...(parentId ? { parentId } : {}),
}) as ComponentConfig;

const tree = [comp('group'), comp('child', 'group'), comp('grandchild', 'child'), comp('loner')];

describe('collectWithDescendants', () => {
  it('returns the component and its whole subtree', () => {
    const { rootIds, collected } = collectWithDescendants(tree, ['group']);
    expect(rootIds).toEqual(['group']);
    expect(collected.map(c => c.id)).toEqual(['group', 'child', 'grandchild']);
  });

  it('drops ids that are already inside another selected subtree', () => {
    const { rootIds, collected } = collectWithDescendants(tree, ['group', 'child']);
    expect(rootIds).toEqual(['group']);
    expect(collected.map(c => c.id)).toEqual(['group', 'child', 'grandchild']);
  });

  it('does not emit a component twice when subtrees overlap', () => {
    const { collected } = collectWithDescendants(tree, ['child', 'grandchild', 'group']);
    const ids = collected.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps genuinely independent selections as separate roots', () => {
    const { rootIds, collected } = collectWithDescendants(tree, ['child', 'loner']);
    expect(rootIds).toEqual(['child', 'loner']);
    expect(collected.map(c => c.id)).toEqual(['child', 'grandchild', 'loner']);
  });

  it('ignores ids that are not in the component list', () => {
    const { rootIds, collected } = collectWithDescendants(tree, ['ghost', 'loner']);
    expect(rootIds).toEqual(['loner']);
    expect(collected.map(c => c.id)).toEqual(['loner']);
  });

  it('returns empty results for an empty selection', () => {
    expect(collectWithDescendants(tree, [])).toEqual({ rootIds: [], collected: [] });
  });

  it('terminates on a cyclic parent chain instead of recursing forever', () => {
    const cyclic = [comp('a', 'b'), comp('b', 'a')];
    const { collected } = collectWithDescendants(cyclic, ['a']);
    expect(collected.map(c => c.id).sort()).toEqual(['a', 'b']);
  });
});
