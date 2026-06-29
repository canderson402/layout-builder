import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SlotTemplate } from '../../types';
import Button from './Button';
import './TemplatePicker.css';

const ALL_KEY = '__all__';

export const folderOf = (t: SlotTemplate): string =>
  t.folder?.trim() || (t.isPreset ? 'Presets' : 'Ungrouped');

export interface TemplatePickerProps {
  templates: SlotTemplate[];
  value: string | null | undefined;
  onChange: (templateId: string) => void;
  placeholder?: string;
  title?: string;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({
  templates,
  value,
  onChange,
  placeholder = 'Select a template…',
  title = 'Select Template',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string>(ALL_KEY);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => templates.find((t) => t.id === value),
    [templates, value]
  );

  const folders = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(folderOf(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const matchesSearch = (t: SlotTemplate, q: string) =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    folderOf(t).toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q);

  const folderCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts = new Map<string, number>();
    templates.forEach((t) => {
      if (!matchesSearch(t, q)) return;
      const f = folderOf(t);
      counts.set(f, (counts.get(f) || 0) + 1);
    });
    return counts;
  }, [templates, search]);

  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (!matchesSearch(t, q)) return false;
      if (activeKey === ALL_KEY) return true;
      return folderOf(t) === activeKey;
    });
  }, [templates, search, activeKey]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      setActiveKey(selected ? folderOf(selected) : ALL_KEY);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (gridPaneRef.current) gridPaneRef.current.scrollTop = 0;
  }, [activeKey]);

  const handleSelect = (t: SlotTemplate) => {
    onChange(t.id);
    setIsOpen(false);
  };

  const visibleByFolder = activeKey === ALL_KEY ? folders : [activeKey];

  return (
    <>
      <button
        type="button"
        className={`tmpl-trigger ${!value ? 'tmpl-trigger--empty' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="tmpl-trigger__labels">
          <span className="tmpl-trigger__title">{selected ? selected.name : placeholder}</span>
          {selected && <span className="tmpl-trigger__subtitle">{folderOf(selected)}</span>}
        </span>
        <span className="tmpl-trigger__chevron" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          className="tmpl-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="tmpl-modal" role="dialog" aria-modal="true" aria-label={title}>
            <header className="tmpl-modal__header">
              <h2 className="tmpl-modal__title">{title}</h2>
              <button
                type="button"
                className="tmpl-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="tmpl-modal__search-row">
              <input
                ref={searchRef}
                type="text"
                className="tmpl-modal__search"
                placeholder="Search by name, folder, or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="tmpl-two-pane">
              <nav className="tmpl-rail" aria-label="Folders">
                <button
                  type="button"
                  className={`tmpl-rail__item ${activeKey === ALL_KEY ? 'tmpl-rail__item--active' : ''}`}
                  onClick={() => setActiveKey(ALL_KEY)}
                >
                  <span className="tmpl-rail__label">All</span>
                  <span className="tmpl-rail__count">
                    {Array.from(folderCounts.values()).reduce((a, b) => a + b, 0)}
                  </span>
                </button>
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tmpl-rail__item ${activeKey === f ? 'tmpl-rail__item--active' : ''}`}
                    onClick={() => setActiveKey(f)}
                  >
                    <span className="tmpl-rail__label">{f}</span>
                    <span className="tmpl-rail__count">{folderCounts.get(f) || 0}</span>
                  </button>
                ))}
              </nav>

              <div className="tmpl-grid-pane" ref={gridPaneRef}>
                {visibleTemplates.length === 0 ? (
                  <div className="tmpl-grid-pane__empty">No templates match your search.</div>
                ) : (
                  visibleByFolder.map((f) => {
                    const items = visibleTemplates.filter((t) => folderOf(t) === f);
                    if (items.length === 0) return null;
                    return (
                      <div key={f}>
                        <h3 className="tmpl-folder-heading">
                          <span>{f}</span>
                          <span className="tmpl-folder-heading__count">{items.length}</span>
                        </h3>
                        <div className="tmpl-grid">
                          {items.map((t) => {
                            const isSelected = t.id === value;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                className={`tmpl-tile ${isSelected ? 'tmpl-tile--selected' : ''}`}
                                onClick={() => handleSelect(t)}
                                title={t.name}
                              >
                                <span className="tmpl-tile__name">{t.name}</span>
                                <span className="tmpl-tile__meta">
                                  {Math.round(t.slotSize.width)}×{Math.round(t.slotSize.height)}
                                  {' · '}
                                  {t.components.length} item{t.components.length === 1 ? '' : 's'}
                                </span>
                                {isSelected && <span className="tmpl-tile__check" aria-hidden="true">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <footer className="tmpl-modal__footer">
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

export default TemplatePicker;
