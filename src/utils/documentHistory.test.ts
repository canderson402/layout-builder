import { describe, it, expect } from 'vitest';
import type { LayoutConfig } from '../types';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';
import {
  DocumentSnapshot,
  HistoryEntry,
  HistoryState,
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  abortTransaction,
  beginTransaction,
  clearHistory,
  commitTransaction,
  createHistory,
  pushEntry,
  redoStep,
  undoStep,
} from './documentHistory';

const layoutSnap = (n: number): DocumentSnapshot => ({
  kind: 'layout',
  document: { name: `layout${n}`, components: [], dimensions: { width: 1920, height: 1080 } } as LayoutConfig,
});

const overlaySnap = (frames: number): DocumentSnapshot => ({
  kind: 'overlay',
  document: {
    id: 'o1',
    name: 'overlay',
    components: [],
    dimensions: { width: 1920, height: 1080 },
    fps: 30,
    startFrame: 0,
    endFrame: frames,
    tracks: [],
  } as OverlayConfig,
});

const entry = (description: string, snapshot: DocumentSnapshot, selection: string[] = []): HistoryEntry =>
  ({ description, snapshot, selection });

const describeUndo = (state: HistoryState) => state.undo.map(e => e.description);
const describeRedo = (state: HistoryState) => state.redo.map(e => e.description);

describe('createHistory', () => {
  it('starts empty with no open transaction', () => {
    const state = createHistory();
    expect(state.undo).toEqual([]);
    expect(state.redo).toEqual([]);
    expect(state.pending).toBeNull();
  });
});

describe('pushEntry', () => {
  it('puts the newest entry at the head', () => {
    let state = createHistory();
    state = pushEntry(state, entry('first', layoutSnap(1)));
    state = pushEntry(state, entry('second', layoutSnap(2)));
    expect(describeUndo(state)).toEqual(['second', 'first']);
  });

  it('clears the redo stack, because a new action forks the timeline', () => {
    let state = createHistory();
    state = pushEntry(state, entry('a', layoutSnap(1)));
    const undone = undoStep(state, entry('current', layoutSnap(2)));
    expect(describeRedo(undone.state)).toEqual(['a']);

    const forked = pushEntry(undone.state, entry('b', layoutSnap(3)));
    expect(forked.redo).toEqual([]);
  });

  it('caps the stack at HISTORY_LIMIT, dropping the oldest', () => {
    let state = createHistory();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      state = pushEntry(state, entry(`e${i}`, layoutSnap(i)));
    }
    expect(state.undo).toHaveLength(HISTORY_LIMIT);
    expect(state.undo[0].description).toBe(`e${HISTORY_LIMIT + 9}`);
    expect(state.undo[HISTORY_LIMIT - 1].description).toBe(`e10`);
  });

  it('does not mutate the input state', () => {
    const state = createHistory();
    const next = pushEntry(state, entry('a', layoutSnap(1)));
    expect(state.undo).toHaveLength(0);
    expect(next).not.toBe(state);
  });
});

describe('undoStep', () => {
  it('returns nothing to restore when the stack is empty', () => {
    const state = createHistory();
    const result = undoStep(state, entry('current', layoutSnap(9)));
    expect(result.restore).toBeNull();
    expect(result.state).toBe(state);
  });

  it('restores the newest entry and banks the current state for redo', () => {
    let state = createHistory();
    state = pushEntry(state, entry('move', layoutSnap(1), ['c1']));

    const result = undoStep(state, entry('move', layoutSnap(2), ['c2']));

    expect(result.restore?.snapshot).toEqual(layoutSnap(1));
    expect(result.restore?.selection).toEqual(['c1']);
    expect(describeUndo(result.state)).toEqual([]);
    expect(describeRedo(result.state)).toEqual(['move']);
    expect(result.state.redo[0].snapshot).toEqual(layoutSnap(2));
    expect(result.state.redo[0].selection).toEqual(['c2']);
  });

  it('walks back through several entries in order', () => {
    let state = createHistory();
    state = pushEntry(state, entry('one', layoutSnap(1)));
    state = pushEntry(state, entry('two', layoutSnap(2)));

    const first = undoStep(state, entry('cur', layoutSnap(3)));
    expect(first.restore?.snapshot).toEqual(layoutSnap(2));

    const second = undoStep(first.state, first.restore!);
    expect(second.restore?.snapshot).toEqual(layoutSnap(1));
    expect(describeRedo(second.state)).toEqual(['one', 'two']);
  });

  it('restores overlay documents whole, including tracks and frame range', () => {
    let state = createHistory();
    state = pushEntry(state, entry('keyframe', overlaySnap(60)));

    const result = undoStep(state, entry('keyframe', overlaySnap(90)));

    expect(result.restore?.snapshot.kind).toBe('overlay');
    expect((result.restore?.snapshot.document as OverlayConfig).endFrame).toBe(60);
  });
});

describe('redoStep', () => {
  it('returns nothing to restore when the stack is empty', () => {
    const result = redoStep(createHistory(), entry('current', layoutSnap(1)));
    expect(result.restore).toBeNull();
  });

  it('reapplies an undone entry and banks the current state for undo', () => {
    let state = createHistory();
    state = pushEntry(state, entry('move', layoutSnap(1), ['c1']));
    const undone = undoStep(state, entry('move', layoutSnap(2), ['c2']));

    const result = redoStep(undone.state, undone.restore!);

    expect(result.restore?.snapshot).toEqual(layoutSnap(2));
    expect(result.restore?.selection).toEqual(['c2']);
    expect(describeUndo(result.state)).toEqual(['move']);
    expect(describeRedo(result.state)).toEqual([]);
  });

  it('survives a full undo-all then redo-all round trip', () => {
    let state = createHistory();
    state = pushEntry(state, entry('one', layoutSnap(1)));
    state = pushEntry(state, entry('two', layoutSnap(2)));

    const u1 = undoStep(state, entry('cur', layoutSnap(3)));
    const u2 = undoStep(u1.state, u1.restore!);
    expect(u2.restore?.snapshot).toEqual(layoutSnap(1));

    const r1 = redoStep(u2.state, u2.restore!);
    expect(r1.restore?.snapshot).toEqual(layoutSnap(2));
    const r2 = redoStep(r1.state, r1.restore!);
    expect(r2.restore?.snapshot).toEqual(layoutSnap(3));
    expect(r2.state.redo).toEqual([]);
    expect(describeUndo(r2.state)).toEqual(['two', 'one']);
  });
});

describe('transactions', () => {
  it('commits one entry holding the state captured at begin, not at commit', () => {
    let state = createHistory();
    state = beginTransaction(state, entry('drag handle', layoutSnap(1)));
    expect(state.undo).toEqual([]);

    state = commitTransaction(state);
    expect(describeUndo(state)).toEqual(['drag handle']);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
    expect(state.pending).toBeNull();
  });

  it('ignores repeat begins so a 60-frame drag yields a single entry', () => {
    let state = createHistory();
    state = beginTransaction(state, entry('drag', layoutSnap(1)));
    for (let i = 2; i < 60; i++) {
      state = beginTransaction(state, entry('drag', layoutSnap(i)));
    }
    state = commitTransaction(state);

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
  });

  it('clears the redo stack on commit, not on begin', () => {
    let state = createHistory();
    state = pushEntry(state, entry('a', layoutSnap(1)));
    state = undoStep(state, entry('a', layoutSnap(2))).state;
    expect(state.redo).toHaveLength(1);

    state = beginTransaction(state, entry('drag', layoutSnap(3)));
    expect(state.redo).toHaveLength(1);

    state = commitTransaction(state);
    expect(state.redo).toEqual([]);
  });

  it('lets commit relabel the entry, for descriptions only known once the drag ends', () => {
    let state = createHistory();
    state = beginTransaction(state, entry('drag', layoutSnap(1)));
    state = commitTransaction(state, { description: 'Move 3 components' });

    expect(describeUndo(state)).toEqual(['Move 3 components']);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
  });

  it('folds repeated gestures into one entry when commit supplies a merge key', () => {
    let state = createHistory();
    let at = 1000;
    for (let i = 1; i <= 20; i++) {
      state = beginTransaction(state, entry('Nudge', layoutSnap(i)));
      state = commitTransaction(state, { mergeKey: 'nudge', at });
      at += 40;
    }

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
  });

  it('keeps separate mouse drags separate when no merge key is given', () => {
    let state = createHistory();
    state = beginTransaction(state, entry('Move', layoutSnap(1)));
    state = commitTransaction(state);
    state = beginTransaction(state, entry('Move', layoutSnap(2)));
    state = commitTransaction(state);

    expect(state.undo).toHaveLength(2);
  });

  it('commit with no open transaction is a no-op', () => {
    const state = createHistory();
    expect(commitTransaction(state)).toBe(state);
  });

  it('abort discards the captured state without touching the stacks', () => {
    let state = createHistory();
    state = pushEntry(state, entry('a', layoutSnap(1)));
    state = beginTransaction(state, entry('drag', layoutSnap(2)));

    state = abortTransaction(state);

    expect(state.pending).toBeNull();
    expect(describeUndo(state)).toEqual(['a']);
  });

  it('does not let an open transaction leak into an undo taken mid-drag', () => {
    let state = createHistory();
    state = pushEntry(state, entry('a', layoutSnap(1)));
    state = beginTransaction(state, entry('drag', layoutSnap(2)));

    const result = undoStep(state, entry('cur', layoutSnap(3)));

    expect(result.restore?.snapshot).toEqual(layoutSnap(1));
    expect(result.state.pending).toBeNull();
  });
});

describe('clearHistory', () => {
  it('drops both stacks and any open transaction', () => {
    let state = createHistory();
    state = pushEntry(state, entry('a', layoutSnap(1)));
    state = undoStep(state, entry('a', layoutSnap(2))).state;
    state = beginTransaction(state, entry('drag', layoutSnap(3)));

    const cleared = clearHistory();

    expect(cleared.undo).toEqual([]);
    expect(cleared.redo).toEqual([]);
    expect(cleared.pending).toBeNull();
  });
});

describe('coalescing by merge key', () => {
  it('collapses a rapid run of same-key edits into one entry', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('Move keyframe', layoutSnap(1)), mergeKey: 'kf:c1:x', at: 1000 });
    for (let i = 2; i <= 30; i++) {
      state = pushEntry(state, { ...entry('Move keyframe', layoutSnap(i)), mergeKey: 'kf:c1:x', at: 1000 + i * 16 });
    }

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
  });

  it('starts a new entry once the merge window lapses', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('Move keyframe', layoutSnap(1)), mergeKey: 'kf:c1:x', at: 1000 });
    state = pushEntry(state, {
      ...entry('Move keyframe', layoutSnap(2)),
      mergeKey: 'kf:c1:x',
      at: 1000 + MERGE_WINDOW_MS + 1,
    });

    expect(state.undo).toHaveLength(2);
    expect(state.undo[1].snapshot).toEqual(layoutSnap(1));
  });

  it('keeps the window alive across a long drag, measuring from the last edit', () => {
    let state = createHistory();
    let at = 1000;
    state = pushEntry(state, { ...entry('drag', layoutSnap(1)), mergeKey: 'k', at });
    for (let i = 0; i < 50; i++) {
      at += MERGE_WINDOW_MS - 1;
      state = pushEntry(state, { ...entry('drag', layoutSnap(i + 2)), mergeKey: 'k', at });
    }

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(1));
  });

  it('does not merge edits with different keys', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('a', layoutSnap(1)), mergeKey: 'kf:c1:x', at: 1000 });
    state = pushEntry(state, { ...entry('b', layoutSnap(2)), mergeKey: 'kf:c1:y', at: 1010 });

    expect(describeUndo(state)).toEqual(['b', 'a']);
  });

  it('never merges entries that carry no key', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('a', layoutSnap(1)), at: 1000 });
    state = pushEntry(state, { ...entry('b', layoutSnap(2)), at: 1010 });

    expect(state.undo).toHaveLength(2);
  });

  it('still clears redo when an edit merges into the previous entry', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('a', layoutSnap(1)), mergeKey: 'k', at: 1000 });
    state = undoStep(state, entry('a', layoutSnap(2))).state;
    state = pushEntry(state, { ...entry('a', layoutSnap(3)), mergeKey: 'k', at: 1010 });

    expect(state.redo).toEqual([]);
  });

  it('does not merge into an entry left exposed by an undo', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('gesture', layoutSnap(1)), mergeKey: 'k', at: 1000 });
    state = pushEntry(state, { ...entry('other', layoutSnap(2)), mergeKey: 'other', at: 1010 });

    const undone = undoStep(state, entry('cur', layoutSnap(3)));
    expect(undone.restore?.snapshot).toEqual(layoutSnap(2));

    const next = pushEntry(undone.state, { ...entry('gesture', layoutSnap(4)), mergeKey: 'k', at: 1020 });

    expect(next.undo).toHaveLength(2);
    expect(next.undo[0].snapshot).toEqual(layoutSnap(4));
  });

  it('does not merge across an undo, so the restored state stays reachable', () => {
    let state = createHistory();
    state = pushEntry(state, { ...entry('a', layoutSnap(1)), mergeKey: 'k', at: 1000 });
    const undone = undoStep(state, entry('a', layoutSnap(2)));
    state = pushEntry(undone.state, { ...entry('a', layoutSnap(3)), mergeKey: 'k', at: 1010 });

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].snapshot).toEqual(layoutSnap(3));
  });
});
