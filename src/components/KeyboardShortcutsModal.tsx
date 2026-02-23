import React, { useEffect, useRef } from 'react';
import './KeyboardShortcutsModal.css';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Click', description: 'Select component' },
      { keys: 'Ctrl/Cmd + Click', description: 'Add/remove from selection' },
      { keys: 'Shift + Click', description: 'Select range' },
      { keys: 'Tab', description: 'Cycle to next component' },
      { keys: 'Shift + Tab', description: 'Cycle to previous component' },
      { keys: 'Escape', description: 'Deselect all' },
    ],
  },
  {
    title: 'Movement',
    shortcuts: [
      { keys: 'Arrow Keys', description: 'Nudge 1px' },
      { keys: 'Shift + Arrow Keys', description: 'Nudge 10px' },
      { keys: 'Alt (hold)', description: 'Disable snapping while dragging' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: 'Delete / Backspace', description: 'Delete selected' },
      { keys: 'Ctrl/Cmd + D', description: 'Duplicate selected' },
      { keys: 'Ctrl/Cmd + C', description: 'Copy selected' },
      { keys: 'Ctrl/Cmd + V', description: 'Paste' },
      { keys: 'Ctrl/Cmd + G', description: 'Group selected' },
      { keys: 'Ctrl/Cmd + Shift + G', description: 'Ungroup selected' },
      { keys: 'Ctrl/Cmd + Z', description: 'Undo' },
      { keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo' },
    ],
  },
  {
    title: 'Transform',
    shortcuts: [
      { keys: 'S', description: 'Enter scale mode' },
      { keys: 'Cmd + Drag', description: 'Copy-drag (duplicate while moving)' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'G', description: 'Toggle grid' },
      { keys: 'H', description: 'Toggle center lines' },
      { keys: 'B', description: 'Toggle bounding boxes' },
      { keys: '+', description: 'Zoom in' },
      { keys: '-', description: 'Zoom out' },
      { keys: '0', description: 'Reset zoom to 100%' },
      { keys: 'F', description: 'Fit canvas to screen' },
      { keys: 'Middle Mouse + Drag', description: 'Pan canvas' },
    ],
  },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Focus trap - Tab should stay within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="shortcuts-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        className="shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="shortcuts-modal-header">
          <h2 id="shortcuts-modal-title">Keyboard Shortcuts</h2>
          <button
            className="shortcuts-modal-close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close keyboard shortcuts"
          >
            &times;
          </button>
        </div>
        <div className="shortcuts-modal-content">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="shortcut-group">
              <h3>{group.title}</h3>
              <dl className="shortcut-list">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="shortcut-item">
                    <dt className="shortcut-keys">
                      {shortcut.keys.split(' + ').map((key, i, arr) => (
                        <React.Fragment key={key}>
                          <kbd>{key}</kbd>
                          {i < arr.length - 1 && <span className="key-separator">+</span>}
                        </React.Fragment>
                      ))}
                    </dt>
                    <dd className="shortcut-description">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="shortcuts-modal-footer">
          <p>Press <kbd>?</kbd> to toggle this dialog</p>
        </div>
      </div>
    </div>
  );
}
