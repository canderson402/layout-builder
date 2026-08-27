import type { LayoutConfig } from '../types';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';

export const HISTORY_LIMIT = 50;

export const MERGE_WINDOW_MS = 700;

export type DocumentSnapshot =
  | { kind: 'layout'; document: LayoutConfig }
  | { kind: 'overlay'; document: OverlayConfig };

export interface HistoryEntry {
  description: string;
  snapshot: DocumentSnapshot;
  selection: string[];
  mergeKey?: string;
  at?: number;
}

export interface HistoryState {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  pending: HistoryEntry | null;
}

export interface HistoryStep {
  state: HistoryState;
  restore: HistoryEntry | null;
}

export function createHistory(): HistoryState {
  return { undo: [], redo: [], pending: null };
}

export function clearHistory(): HistoryState {
  return createHistory();
}

function stack(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries].slice(0, HISTORY_LIMIT);
}

function sealed(entries: HistoryEntry[]): HistoryEntry[] {
  const [top, ...rest] = entries;
  if (!top || top.mergeKey === undefined) return entries;
  const { mergeKey: _dropped, ...withoutKey } = top;
  return [withoutKey, ...rest];
}

function mergesInto(previous: HistoryEntry | undefined, entry: HistoryEntry): boolean {
  if (!previous || entry.mergeKey === undefined || previous.mergeKey !== entry.mergeKey) return false;
  if (previous.at === undefined || entry.at === undefined) return false;
  return entry.at - previous.at <= MERGE_WINDOW_MS;
}

export function pushEntry(state: HistoryState, entry: HistoryEntry): HistoryState {
  const previous = state.undo[0];

  if (mergesInto(previous, entry)) {
    const [, ...rest] = state.undo;
    return {
      undo: [{ ...previous, at: entry.at }, ...rest],
      redo: [],
      pending: null,
    };
  }

  return { undo: stack(state.undo, entry), redo: [], pending: null };
}

export function beginTransaction(state: HistoryState, entry: HistoryEntry): HistoryState {
  if (state.pending) return state;
  return { ...state, pending: entry };
}

export interface CommitOptions {
  description?: string;
  mergeKey?: string;
  at?: number;
}

export function commitTransaction(state: HistoryState, options: CommitOptions = {}): HistoryState {
  if (!state.pending) return state;
  const entry: HistoryEntry = {
    ...state.pending,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.mergeKey !== undefined ? { mergeKey: options.mergeKey, at: options.at } : {}),
  };
  return pushEntry({ ...state, pending: null }, entry);
}

export function abortTransaction(state: HistoryState): HistoryState {
  if (!state.pending) return state;
  return { ...state, pending: null };
}

export function undoStep(state: HistoryState, current: HistoryEntry): HistoryStep {
  if (state.undo.length === 0) return { state, restore: null };
  const [restore, ...remaining] = state.undo;
  return {
    state: {
      undo: sealed(remaining),
      redo: sealed(stack(state.redo, { ...current, description: restore.description })),
      pending: null,
    },
    restore,
  };
}

export function redoStep(state: HistoryState, current: HistoryEntry): HistoryStep {
  if (state.redo.length === 0) return { state, restore: null };
  const [restore, ...remaining] = state.redo;
  return {
    state: {
      undo: sealed(stack(state.undo, { ...current, description: restore.description })),
      redo: sealed(remaining),
      pending: null,
    },
    restore,
  };
}
