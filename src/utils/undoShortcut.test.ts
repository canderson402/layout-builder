import { describe, it, expect } from 'vitest';
import { isTextEntryTarget, matchesRedoShortcut, matchesUndoShortcut } from './undoShortcut';

const el = (tagName: string, contentEditable = false) =>
  ({ tagName, isContentEditable: contentEditable }) as unknown as Element;

const key = (k: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}) =>
  ({ key: k, metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift }) as KeyboardEvent;

describe('isTextEntryTarget', () => {
  it('treats real text entry as text entry, so native undo still works there', () => {
    expect(isTextEntryTarget(el('INPUT'))).toBe(true);
    expect(isTextEntryTarget(el('TEXTAREA'))).toBe(true);
    expect(isTextEntryTarget(el('DIV', true))).toBe(true);
  });

  it('does NOT treat a button as text entry', () => {
    expect(isTextEntryTarget(el('BUTTON'))).toBe(false);
  });

  it('does NOT treat a select as text entry', () => {
    expect(isTextEntryTarget(el('SELECT'))).toBe(false);
  });

  it('does not treat a plain container or the body as text entry', () => {
    expect(isTextEntryTarget(el('DIV'))).toBe(false);
    expect(isTextEntryTarget(el('BODY'))).toBe(false);
  });

  it('handles a null target', () => {
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe('matchesUndoShortcut', () => {
  it('matches Cmd+Z and Ctrl+Z', () => {
    expect(matchesUndoShortcut(key('z', { meta: true }))).toBe(true);
    expect(matchesUndoShortcut(key('z', { ctrl: true }))).toBe(true);
  });

  it('matches an uppercase Z, which is what arrives with some layouts', () => {
    expect(matchesUndoShortcut(key('Z', { meta: true }))).toBe(true);
  });

  it('does not match plain z, or Shift+Cmd+Z (that is redo)', () => {
    expect(matchesUndoShortcut(key('z'))).toBe(false);
    expect(matchesUndoShortcut(key('z', { meta: true, shift: true }))).toBe(false);
  });

  it('does not match other keys', () => {
    expect(matchesUndoShortcut(key('y', { meta: true }))).toBe(false);
  });
});

describe('matchesRedoShortcut', () => {
  it('matches Shift+Cmd+Z and Ctrl+Y', () => {
    expect(matchesRedoShortcut(key('z', { meta: true, shift: true }))).toBe(true);
    expect(matchesRedoShortcut(key('Z', { ctrl: true, shift: true }))).toBe(true);
    expect(matchesRedoShortcut(key('y', { ctrl: true }))).toBe(true);
    expect(matchesRedoShortcut(key('y', { meta: true }))).toBe(true);
  });

  it('does not match plain undo', () => {
    expect(matchesRedoShortcut(key('z', { meta: true }))).toBe(false);
  });

  it('does not treat undo and redo as the same event', () => {
    const undoEvent = key('z', { meta: true });
    expect(matchesUndoShortcut(undoEvent) && matchesRedoShortcut(undoEvent)).toBe(false);
    const redoEvent = key('z', { meta: true, shift: true });
    expect(matchesUndoShortcut(redoEvent) && matchesRedoShortcut(redoEvent)).toBe(false);
  });
});
