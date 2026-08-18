import { describe, it, expect, beforeEach } from 'vitest';
import { getSlotListBounds } from './slotListBounds';
import { ComponentConfig, SlotTemplate } from '../types';

// slotListBounds resolves templates through localStorage; vitest runs in node.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

// slotSize is 200x100 but the row only draws 180x60 — the padding is exactly
// what the old bounding box showed and the new one must not.
const TEMPLATE: SlotTemplate = {
  id: 'tpl-1',
  name: 'row',
  components: [
    { id: 'a', type: 'custom', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } },
    { id: 'b', type: 'custom', position: { x: 120, y: 10 }, size: { width: 60, height: 40 } },
    { id: 'g', type: 'group', position: { x: 0, y: 0 }, size: { width: 500, height: 500 } },
  ] as ComponentConfig[],
  slotSize: { width: 200, height: 100 },
  createdAt: 0,
  updatedAt: 0,
};

const slotList = (props: Record<string, any>): ComponentConfig => ({
  id: 'list-1',
  type: 'slotList',
  position: { x: 50, y: 20 },
  size: { width: 200, height: 520 },
  props: { templateId: 'tpl-1', ...props },
} as ComponentConfig);

beforeEach(() => {
  store.set('sv-slot-templates', JSON.stringify([TEMPLATE]));
});

describe('getSlotListBounds', () => {
  it('hugs the drawn rows instead of the container frame, vertically', () => {
    // 3 rows, pitch 100 + 5 spacing => last row starts at y 210, draws to 270
    const bounds = getSlotListBounds(slotList({ slotCount: 3, slotSpacing: 5 }));
    expect(bounds).toEqual({ x: 50, y: 20, width: 180, height: 270 });
  });

  it('hugs the drawn columns horizontally', () => {
    const bounds = getSlotListBounds(slotList({ slotCount: 3, slotSpacing: 5, direction: 'horizontal' }));
    // last column offset 410, draws to 410 + 180
    expect(bounds).toEqual({ x: 50, y: 20, width: 590, height: 60 });
  });

  it('ignores groups, which have no drawn footprint', () => {
    const bounds = getSlotListBounds(slotList({ slotCount: 1 }));
    expect(bounds).toEqual({ x: 50, y: 20, width: 180, height: 60 });
  });

  it('shrinks to the dynamic slot count from game data', () => {
    const bounds = getSlotListBounds(
      slotList({ slotCount: 5, slotSpacing: 5, slotCountPath: 'setSlots.home.count' }),
      { setSlots: { home: { count: 2 } } },
    );
    expect(bounds).toEqual({ x: 50, y: 20, width: 180, height: 165 });
  });

  it('counts only active slots when hideInactiveSlots is on', () => {
    const bounds = getSlotListBounds(
      slotList({ slotCount: 4, slotSpacing: 5, hideInactiveSlots: true, dataPathPrefix: 'leaderboardSlots' }),
      {
        leaderboardSlots: {
          home: {
            slot0: { active: true },
            slot1: { active: false },
            slot2: { active: true },
            slot3: { active: false },
          },
        },
      },
    );
    // 2 visible rows stack consecutively: 105 + 60
    expect(bounds).toEqual({ x: 50, y: 20, width: 180, height: 165 });
  });

  it('returns null when no template resolves, so the placeholder box is used', () => {
    store.set('sv-slot-templates', JSON.stringify([]));
    expect(getSlotListBounds(slotList({ slotCount: 3 }))).toBeNull();
  });

  it('returns null for non-slotList components', () => {
    const other: ComponentConfig = {
      id: 'x', type: 'score', position: { x: 0, y: 0 }, size: { width: 10, height: 10 },
    } as ComponentConfig;
    expect(getSlotListBounds(other)).toBeNull();
  });
});
