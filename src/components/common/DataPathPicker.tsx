import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  findOption,
  groupedOptionsForPurpose,
  PathOption,
  PathPurpose,
} from './dataPathOptions';
import Button from './Button';
import './DataPathPicker.css';

/**
 * Replacement for inline <select> dropdowns when binding components to game
 * data. Renders a button trigger that opens a fixed-size two-pane modal:
 * a group rail on the left for quick navigation, a tile grid on the right
 * showing every option (filterable via the top search input).
 *
 * The button shows the option's friendly title with the raw JSON path as a
 * sublabel — so designers see human-readable names but can still spot the
 * underlying path when debugging.
 *
 * `purpose` filters the catalog: 'data' shows value-type paths, 'toggle' /
 * 'visibility' show boolean-y paths. `includeSlotContext` opts in to the
 * short auto-prefixed paths that only make sense inside a slot template.
 */

export interface DataPathPickerProps {
  /** Current path value (or null/undefined/empty for "no selection"). */
  value: string | null | undefined;
  /** Called with the new path. Pass '' or null when the user clears. */
  onChange: (value: string) => void;
  /** Which kind of binding this picker serves — filters the catalog. */
  purpose: PathPurpose;
  /** Show short auto-prefixed slot-template paths (e.g. `won`, `score`). */
  includeSlotContext?: boolean;
  /** Modal title override (defaults based on purpose). */
  title?: string;
  /** Button placeholder text when no value is selected. */
  placeholder?: string;
  /** Append a synthetic "No Data" / "None" option that clears the value. */
  allowClear?: boolean;
  /** Label shown for the clear option. Defaults to "No Data (Display Only)". */
  clearLabel?: string;
}

const defaultTitleFor = (purpose: PathPurpose): string => {
  switch (purpose) {
    case 'data': return 'Select Data Path';
    case 'toggle': return 'Select Toggle Path';
    case 'visibility': return 'Select Visibility Path';
  }
};

// Build a DOM-safe id from a group name.
const groupSectionId = (purpose: PathPurpose, group: string) =>
  `dpp-${purpose}-${group.replace(/[^a-zA-Z0-9]+/g, '-')}`;

const DataPathPicker: React.FC<DataPathPickerProps> = ({
  value,
  onChange,
  purpose,
  includeSlotContext = true,
  title,
  placeholder = 'No Data (Display Only)',
  allowClear = true,
  clearLabel = 'No Data (Display Only)',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);

  // Normalize value — '' / 'none' are both treated as no selection.
  const normalized = !value || value === 'none' ? '' : value;
  const selectedOption = useMemo(() => findOption(normalized), [normalized]);

  const groups = useMemo(
    () => groupedOptionsForPurpose(purpose, { includeSlotContext }),
    [purpose, includeSlotContext],
  );

  // Filter groups by search query. Match against label, value, or group.
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({
        group: g.group,
        items: g.items.filter(o =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          o.group.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, search]);

  // Auto-focus search input on open + seed the active group.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      // Default active group: the one containing the current selection, or
      // the first available group.
      const seed = selectedOption?.group || filteredGroups[0]?.group || null;
      setActiveGroup(seed);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Keep active group valid as search filters the rail. If the current
  // active group drops out of the filtered list, snap to the first one
  // that has matches.
  useEffect(() => {
    if (!isOpen) return;
    if (filteredGroups.length === 0) {
      if (activeGroup !== null) setActiveGroup(null);
      return;
    }
    const stillVisible = filteredGroups.some(g => g.group === activeGroup);
    if (!stillVisible) {
      setActiveGroup(filteredGroups[0].group);
    }
  }, [isOpen, filteredGroups, activeGroup]);

  // Scroll the grid pane back to the top whenever the active group changes,
  // so each group starts at the first tile.
  useEffect(() => {
    if (gridPaneRef.current) gridPaneRef.current.scrollTop = 0;
  }, [activeGroup]);

  const handleSelect = (option: PathOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleRailClick = (group: string) => {
    setActiveGroup(group);
  };

  const activeGroupData = filteredGroups.find(g => g.group === activeGroup) || null;

  // Display values for the trigger button.
  const triggerTitle = selectedOption?.label
    ?? (normalized ? normalized : placeholder);
  const triggerSubtitle = selectedOption
    ? selectedOption.value
    : (normalized || null);

  return (
    <>
      <button
        type="button"
        className={`dpp-trigger ${!normalized ? 'dpp-trigger--empty' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="dpp-trigger__title">{triggerTitle}</span>
        {triggerSubtitle && (
          <span className="dpp-trigger__subtitle">{triggerSubtitle}</span>
        )}
        <span className="dpp-trigger__chevron" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          className="dpp-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="dpp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title || defaultTitleFor(purpose)}
          >
            <header className="dpp-modal__header">
              <h2 className="dpp-modal__title">{title || defaultTitleFor(purpose)}</h2>
              <button
                type="button"
                className="dpp-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="dpp-modal__search-row">
              <input
                ref={searchRef}
                type="text"
                className="dpp-modal__search"
                placeholder="Search by label, path, or group…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="dpp-two-pane">
              {/* Group nav rail */}
              <nav className="dpp-rail" aria-label="Groups">
                {filteredGroups.length === 0 ? (
                  <div className="dpp-rail__empty">No matches</div>
                ) : (
                  filteredGroups.map((g) => (
                    <button
                      key={g.group}
                      type="button"
                      className={`dpp-rail__item ${activeGroup === g.group ? 'dpp-rail__item--active' : ''}`}
                      onClick={() => handleRailClick(g.group)}
                    >
                      <span className="dpp-rail__label">{g.group}</span>
                      <span className="dpp-rail__count">{g.items.length}</span>
                    </button>
                  ))
                )}
              </nav>

              {/* Tile grid pane — shows only the active group's options. */}
              <div
                className="dpp-grid-pane"
                ref={gridPaneRef}
                id={activeGroupData ? groupSectionId(purpose, activeGroupData.group) : undefined}
              >
                {!activeGroupData ? (
                  <div className="dpp-grid-pane__empty">No options match your search.</div>
                ) : (
                  <section className="dpp-group-section">
                    <h3 className="dpp-group-heading">
                      <span>{activeGroupData.group}</span>
                      <span className="dpp-group-heading__count">{activeGroupData.items.length}</span>
                    </h3>
                    <div className="dpp-grid">
                      {activeGroupData.items.map((o) => {
                        const isSelected = o.value === normalized;
                        return (
                          <button
                            key={`${o.group}::${o.value}`}
                            type="button"
                            className={`dpp-tile ${isSelected ? 'dpp-tile--selected' : ''}`}
                            onClick={() => handleSelect(o)}
                            title={o.description}
                          >
                            <span className="dpp-tile__title">{o.label}</span>
                            <span className="dpp-tile__path">{o.value}</span>
                            {isSelected && <span className="dpp-tile__check" aria-hidden="true">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <footer className="dpp-modal__footer">
              {allowClear && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  {clearLabel}
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default DataPathPicker;
