import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  findOption,
  groupedOptionsForPurpose,
  PathOption,
  PathPurpose,
} from './dataPathOptions';
import {
  ConditionGroup,
  describeConditionGroup,
  hasConditions,
} from '../../shared/conditions';
import ConditionBuilder from './ConditionBuilder';
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
 *
 * When `onConditionChange` is provided the modal gains a second tab — a
 * condition editor where any game value can be compared against a literal
 * or another game value (e.g. homeTeam.score > awayTeam.score). Picking an
 * operand reuses the same browse pane in-place (no stacked modals). A set
 * condition overrides the simple path, and the trigger button reflects it.
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
  /** Current condition group — enables the Condition tab with onConditionChange. */
  conditionValue?: ConditionGroup;
  /** Called as the condition is edited. Presence enables the Condition tab. */
  onConditionChange?: (next: ConditionGroup | undefined) => void;
  /** Hint shown in the condition tab when no conditions exist. */
  conditionHint?: string;
  /**
   * Condition-only mode: the trigger is a plain "Edit Conditions" button
   * (no binding preview) and the modal opens straight into the condition
   * editor — no Simple Path tab. `value`/`onChange` are unused.
   */
  conditionOnly?: boolean;
}

const defaultTitleFor = (purpose: PathPurpose): string => {
  switch (purpose) {
    case 'data': return 'Select Data Path';
    case 'toggle': return 'Select Toggle Path';
    case 'visibility': return 'Select Visibility Path';
    case 'condition': return 'Select Game Value';
  }
};

// Build a DOM-safe id from a group name.
const groupSectionId = (purpose: PathPurpose, group: string) =>
  `dpp-${purpose}-${group.replace(/[^a-zA-Z0-9]+/g, '-')}`;

/** Pending in-modal operand pick for a condition row. */
interface PathPickRequest {
  commit: (path: string) => void;
}

const DataPathPicker: React.FC<DataPathPickerProps> = ({
  value,
  onChange,
  purpose,
  includeSlotContext = true,
  title,
  placeholder = 'No Data (Display Only)',
  allowClear = true,
  clearLabel = 'No Data (Display Only)',
  conditionValue,
  onConditionChange,
  conditionHint,
  conditionOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [tab, setTab] = useState<'path' | 'condition'>('path');
  const [pathPickRequest, setPathPickRequest] = useState<PathPickRequest | null>(null);
  // Condition edits are buffered locally while the modal is open and only
  // committed on close. Committing live would update the component, which
  // remounts the property panel subtree and would close this modal.
  const [conditionDraft, setConditionDraft] = useState<ConditionGroup | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);

  const conditionsEnabled = !!onConditionChange;
  const conditionIsSet = hasConditions(conditionValue);
  const draftIsSet = hasConditions(conditionDraft);

  // Normalize value — '' / 'none' are both treated as no selection.
  const normalized = !value || value === 'none' ? '' : value;
  const selectedOption = useMemo(() => findOption(normalized), [normalized]);

  // Operand picks browse the full catalog; the path tab uses this picker's purpose.
  const browsePurpose: PathPurpose = pathPickRequest ? 'condition' : purpose;

  const groups = useMemo(
    () => groupedOptionsForPurpose(browsePurpose, { includeSlotContext }),
    [browsePurpose, includeSlotContext],
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

  const showBrowsePane = tab === 'path' || pathPickRequest !== null;

  // Auto-focus search input on open + seed the active group and tab.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      // Default active group: the one containing the current selection, or
      // the first available group.
      const seed = selectedOption?.group || filteredGroups[0]?.group || null;
      setActiveGroup(seed);
      // Land on the tab that reflects the current binding.
      setTab(conditionOnly || (conditionsEnabled && conditionIsSet) ? 'condition' : 'path');
      setPathPickRequest(null);
      // Seed the draft from the committed value.
      setConditionDraft(conditionValue);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Commit the buffered condition draft (if it changed) and close. Every
  // close path goes through here so edits are never silently dropped.
  const closeAndCommit = () => {
    if (conditionsEnabled) {
      const before = JSON.stringify(conditionValue ?? null);
      const after = JSON.stringify(conditionDraft ?? null);
      if (before !== after) onConditionChange!(conditionDraft);
    }
    setIsOpen(false);
  };

  // Close on Escape — but an in-progress operand pick backs out first.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pathPickRequest) {
          setPathPickRequest(null);
        } else {
          closeAndCommit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, pathPickRequest, conditionDraft, conditionValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep active group valid as search filters the rail. If the current
  // active group drops out of the filtered list, snap to the first one
  // that has matches.
  useEffect(() => {
    if (!isOpen || !showBrowsePane) return;
    if (filteredGroups.length === 0) {
      if (activeGroup !== null) setActiveGroup(null);
      return;
    }
    const stillVisible = filteredGroups.some(g => g.group === activeGroup);
    if (!stillVisible) {
      setActiveGroup(filteredGroups[0].group);
    }
  }, [isOpen, showBrowsePane, filteredGroups, activeGroup]);

  // Scroll the grid pane back to the top whenever the active group changes,
  // so each group starts at the first tile.
  useEffect(() => {
    if (gridPaneRef.current) gridPaneRef.current.scrollTop = 0;
  }, [activeGroup]);

  const handleSelect = (option: PathOption) => {
    if (pathPickRequest) {
      // Operand pick for a condition row — commit and return to the editor.
      pathPickRequest.commit(option.value);
      setPathPickRequest(null);
      setSearch('');
      return;
    }
    // Choosing a simple path replaces any condition (they're alternatives),
    // so the draft is intentionally NOT committed here. Hosts with
    // conditions enabled must clear the condition inside their onChange
    // handler (one atomic component update) — a separate onConditionChange
    // call would clobber the path update, since both handlers spread the
    // same stale props snapshot.
    onChange(option.value);
    setIsOpen(false);
  };

  const handleClear = () => {
    // Clears both path and condition (at the binding site) — drop the draft.
    onChange('');
    setIsOpen(false);
  };

  const handleRailClick = (group: string) => {
    setActiveGroup(group);
  };

  const handleRequestPath = (_current: string | undefined, commit: (path: string) => void) => {
    setSearch('');
    setPathPickRequest({ commit });
  };

  const activeGroupData = filteredGroups.find(g => g.group === activeGroup) || null;

  // Display values for the trigger button. A set condition wins over the path.
  const conditionSummary = conditionIsSet
    ? describeConditionGroup(conditionValue!)
    : null;
  const triggerTitle = conditionOnly
    ? 'Edit Conditions'
    : conditionSummary
    ? `Condition (${conditionValue!.conditions.length})`
    : (selectedOption?.label ?? (normalized ? normalized : placeholder));
  const triggerSubtitle = conditionOnly
    ? null
    : conditionSummary
    ?? (selectedOption ? selectedOption.value : (normalized || null));

  const modalTitle = conditionOnly ? (title || 'Edit Conditions') : (title || defaultTitleFor(purpose));

  return (
    <>
      <button
        type="button"
        className={`dpp-trigger ${!normalized && !conditionSummary ? 'dpp-trigger--empty' : ''} ${conditionSummary ? 'dpp-trigger--condition' : ''}`}
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
            if (e.target === e.currentTarget) closeAndCommit();
          }}
        >
          <div
            className="dpp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modalTitle}
          >
            <header className="dpp-modal__header">
              <h2 className="dpp-modal__title">{modalTitle}</h2>
              <button
                type="button"
                className="dpp-modal__close"
                onClick={closeAndCommit}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            {/* Tab bar — only when this binding supports conditions. Hidden
                while picking an operand so the back bar can take its place. */}
            {conditionsEnabled && !pathPickRequest && !conditionOnly && (
              <div className="dpp-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'path'}
                  className={`dpp-tab ${tab === 'path' ? 'dpp-tab--active' : ''}`}
                  onClick={() => setTab('path')}
                >
                  Simple Path
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'condition'}
                  className={`dpp-tab ${tab === 'condition' ? 'dpp-tab--active' : ''}`}
                  onClick={() => setTab('condition')}
                >
                  Condition{draftIsSet ? ` (${conditionDraft!.conditions.length})` : ''}
                </button>
              </div>
            )}

            {pathPickRequest && (
              <div className="dpp-backbar">
                <button
                  type="button"
                  className="dpp-backbar__btn"
                  onClick={() => setPathPickRequest(null)}
                >
                  ← Back to Condition
                </button>
                <span className="dpp-backbar__hint">Pick a game value for the condition</span>
              </div>
            )}

            {showBrowsePane ? (
              <>
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
                    id={activeGroupData ? groupSectionId(browsePurpose, activeGroupData.group) : undefined}
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
                            const isSelected = !pathPickRequest && o.value === normalized;
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
              </>
            ) : (
              /* Condition editor tab — edits the local draft; committed once
                 when the modal closes (Done / X / backdrop / Escape). */
              <div className="dpp-condition-pane">
                <ConditionBuilder
                  value={conditionDraft}
                  onChange={setConditionDraft}
                  emptyHint={conditionHint || 'No conditions yet — add one below'}
                  onRequestPath={handleRequestPath}
                />
              </div>
            )}

            <footer className="dpp-modal__footer">
              {allowClear && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  {clearLabel}
                </Button>
              )}
              <Button variant="default" size="sm" onClick={closeAndCommit}>
                {tab === 'condition' && conditionsEnabled ? 'Done' : 'Cancel'}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default DataPathPicker;
