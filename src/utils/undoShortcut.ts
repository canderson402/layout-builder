export function isTextEntryTarget(target: Element | null): boolean {
  if (!target) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  return (target as HTMLElement).isContentEditable === true;
}

const isZ = (key: string): boolean => key === 'z' || key === 'Z';
const isY = (key: string): boolean => key === 'y' || key === 'Y';

const hasCommandModifier = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey;

export function matchesUndoShortcut(event: KeyboardEvent): boolean {
  return hasCommandModifier(event) && !event.shiftKey && isZ(event.key);
}

export function matchesRedoShortcut(event: KeyboardEvent): boolean {
  if (!hasCommandModifier(event)) return false;
  if (isY(event.key)) return true;
  return event.shiftKey && isZ(event.key);
}
