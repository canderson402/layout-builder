import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DocumentSnapshot,
  HistoryEntry,
  HistoryState,
  abortTransaction,
  beginTransaction,
  clearHistory,
  commitTransaction,
  createHistory,
  pushEntry,
  redoStep,
  undoStep,
} from '../utils/documentHistory';

export interface DocumentHistoryOptions {
  getSnapshot: () => DocumentSnapshot;
  getSelection: () => string[];
  onRestore: (entry: HistoryEntry) => void;
}

export interface DocumentHistory {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  undoLabel: string | null;
  redoLabel: string | null;
  capture: (description: string) => void;
  captureCoalesced: (mergeKey: string, description: string) => void;
  begin: (description: string) => void;
  commit: (description?: string, mergeKey?: string) => void;
  abort: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

interface HistoryView {
  undoDepth: number;
  redoDepth: number;
  undoLabel: string | null;
  redoLabel: string | null;
}

const viewOf = (state: HistoryState): HistoryView => ({
  undoDepth: state.undo.length,
  redoDepth: state.redo.length,
  undoLabel: state.undo[0]?.description ?? null,
  redoLabel: state.redo[0]?.description ?? null,
});

const EMPTY_VIEW = viewOf(createHistory());

export function useDocumentHistory({
  getSnapshot,
  getSelection,
  onRestore,
}: DocumentHistoryOptions): DocumentHistory {
  const stateRef = useRef<HistoryState>(createHistory());
  const [view, setView] = useState<HistoryView>(EMPTY_VIEW);

  const getSnapshotRef = useRef(getSnapshot);
  const getSelectionRef = useRef(getSelection);
  const onRestoreRef = useRef(onRestore);
  getSnapshotRef.current = getSnapshot;
  getSelectionRef.current = getSelection;
  onRestoreRef.current = onRestore;

  const apply = useCallback((next: HistoryState) => {
    const previous = stateRef.current;
    stateRef.current = next;
    if (next === previous) return;
    setView(prev => {
      const nextView = viewOf(next);
      const unchanged =
        prev.undoDepth === nextView.undoDepth &&
        prev.redoDepth === nextView.redoDepth &&
        prev.undoLabel === nextView.undoLabel &&
        prev.redoLabel === nextView.redoLabel;
      return unchanged ? prev : nextView;
    });
  }, []);

  const entryFor = useCallback((description: string): HistoryEntry => ({
    description,
    snapshot: getSnapshotRef.current(),
    selection: getSelectionRef.current(),
  }), []);

  const capture = useCallback((description: string) => {
    apply(pushEntry(stateRef.current, entryFor(description)));
  }, [apply, entryFor]);

  const captureCoalesced = useCallback((mergeKey: string, description: string) => {
    apply(pushEntry(stateRef.current, {
      ...entryFor(description),
      mergeKey,
      at: Date.now(),
    }));
  }, [apply, entryFor]);

  const begin = useCallback((description: string) => {
    apply(beginTransaction(stateRef.current, entryFor(description)));
  }, [apply, entryFor]);

  const commit = useCallback((description?: string, mergeKey?: string) => {
    apply(commitTransaction(stateRef.current, { description, mergeKey, at: Date.now() }));
  }, [apply]);

  const abort = useCallback(() => {
    apply(abortTransaction(stateRef.current));
  }, [apply]);

  const undo = useCallback(() => {
    const top = stateRef.current.undo[0];
    if (!top) return;
    const result = undoStep(stateRef.current, entryFor(top.description));
    if (!result.restore) return;
    apply(result.state);
    onRestoreRef.current(result.restore);
  }, [apply, entryFor]);

  const redo = useCallback(() => {
    const top = stateRef.current.redo[0];
    if (!top) return;
    const result = redoStep(stateRef.current, entryFor(top.description));
    if (!result.restore) return;
    apply(result.state);
    onRestoreRef.current(result.restore);
  }, [apply, entryFor]);

  const reset = useCallback(() => {
    apply(clearHistory());
  }, [apply]);

  return useMemo(() => ({
    canUndo: view.undoDepth > 0,
    canRedo: view.redoDepth > 0,
    undoDepth: view.undoDepth,
    redoDepth: view.redoDepth,
    undoLabel: view.undoLabel,
    redoLabel: view.redoLabel,
    capture,
    captureCoalesced,
    begin,
    commit,
    abort,
    undo,
    redo,
    reset,
  }), [view, capture, captureCoalesced, begin, commit, abort, undo, redo, reset]);
}
