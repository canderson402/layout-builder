import React, { useCallback, useEffect, useState } from 'react';
import './CollapsibleSection.css';

const STORAGE_KEY = 'sv-layout-builder-collapsed';

/**
 * Read the persisted collapse state map from localStorage.
 * Returns Record<sectionId, isCollapsed>.
 */
const readStoredState = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredState = (state: Record<string, boolean>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full / unavailable — collapse state just won't persist this session.
  }
};

/**
 * Hook: returns [isOpen, toggle] for a section id. Persists to localStorage
 * under one shared key so all CollapsibleSections agree on storage shape.
 */
export function useCollapsibleState(id: string, defaultOpen: boolean = true): [boolean, () => void] {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const stored = readStoredState();
    if (id in stored) return !stored[id]; // stored value is isCollapsed → invert to isOpen
    return defaultOpen;
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      const stored = readStoredState();
      stored[id] = !next; // persist isCollapsed
      writeStoredState(stored);
      return next;
    });
  }, [id]);

  return [isOpen, toggle];
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  count,
  defaultOpen = true,
  actions,
  children,
}) => {
  const [isOpen, toggle] = useCollapsibleState(id, defaultOpen);

  // Stop click on the actions slot from bubbling to the header toggle.
  const actionsOnClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <section className={`cs-section ${isOpen ? 'cs-open' : 'cs-closed'}`}>
      <header
        className="cs-header"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={isOpen}
        aria-controls={`cs-${id}-body`}
      >
        <svg
          className="cs-chevron"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <path d="M3 1 L7 5 L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="cs-title">{title}</span>
        {typeof count === 'number' && <span className="cs-count">{count}</span>}
        {actions && (
          <span className="cs-actions" onClick={actionsOnClick} onKeyDown={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
      </header>
      {isOpen && (
        <div className="cs-body" id={`cs-${id}-body`}>
          {children}
        </div>
      )}
    </section>
  );
};

export default CollapsibleSection;
