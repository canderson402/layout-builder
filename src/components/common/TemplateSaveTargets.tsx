import React, { useMemo, useState } from 'react';
import './TemplateSaveTargets.css';

/**
 * Searchable list of existing templates inside a save dialog, so saving over
 * one is a click instead of retyping its name from memory. Picking an entry
 * fills the name (and folder) fields — the save itself still goes through the
 * name, which is what both template stores key on for replace-vs-add.
 *
 * The entry matching the typed name is marked as the overwrite target.
 */

export interface SaveTarget {
  id: string;
  name: string;
  folder?: string;
  updatedAt?: number;
}

export interface TemplateSaveTargetsProps {
  templates: SaveTarget[];
  /** Current value of the dialog's name field. */
  name: string;
  onPick: (name: string, folder?: string) => void;
  /** Accent for the selected row — matches each dialog's save button. */
  accentColor?: string;
}

const TemplateSaveTargets: React.FC<TemplateSaveTargetsProps> = ({
  templates,
  name,
  onPick,
  accentColor = '#2196F3',
}) => {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? templates.filter(t =>
          t.name.toLowerCase().includes(q) ||
          (t.folder || '').toLowerCase().includes(q))
      : templates;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, search]);

  if (templates.length === 0) return null;

  const typed = name.trim().toLowerCase();

  return (
    <div className="save-targets">
      <label className="save-targets__label" htmlFor="save-targets-search">
        Overwrite an existing template
      </label>
      <input
        id="save-targets-search"
        type="text"
        className="save-targets__search"
        placeholder={`Search ${templates.length} template${templates.length === 1 ? '' : 's'}…`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="save-targets__list" role="listbox">
        {matches.length === 0 && (
          <div className="save-targets__empty">No matches</div>
        )}
        {matches.map(t => {
          const isTarget = t.name.trim().toLowerCase() === typed;
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={isTarget}
              className={`save-targets__item ${isTarget ? 'is-target' : ''}`}
              style={isTarget ? { borderColor: accentColor } : undefined}
              onClick={() => onPick(t.name, t.folder)}
              title={t.folder ? `${t.folder} / ${t.name}` : t.name}
            >
              <span className="save-targets__name">{t.name}</span>
              {t.folder && <span className="save-targets__folder">{t.folder}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateSaveTargets;
