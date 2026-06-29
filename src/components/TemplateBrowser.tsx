import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from './common/Button';
import './common/TemplatePicker.css';

export interface BrowserItem {
  id: string;
  name: string;
  folder?: string;
  meta?: React.ReactNode;
  locked?: boolean;
}

interface TemplateBrowserProps {
  triggerIcon: React.ReactNode;
  triggerTitle: string;
  title: string;
  items: BrowserItem[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder: (id: string, folder: string) => void;
  emptyText: string;
}

const ALL_KEY = '__all__';
const folderOf = (it: BrowserItem) => it.folder?.trim() || 'Ungrouped';

const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  triggerIcon,
  triggerTitle,
  title,
  items,
  onLoad,
  onDelete,
  onMoveFolder,
  emptyText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string>(ALL_KEY);
  const searchRef = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => set.add(folderOf(it)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter(
      (it) => !q || it.name.toLowerCase().includes(q) || folderOf(it).toLowerCase().includes(q)
    );
    const map = new Map<string, BrowserItem[]>();
    filtered.forEach((it) => {
      const f = folderOf(it);
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(it);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, search]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      setActiveKey(ALL_KEY);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleMove = (it: BrowserItem, raw: string) => {
    if (raw === '__new__') {
      const name = window.prompt('New folder name:', folderOf(it))?.trim();
      if (name) onMoveFolder(it.id, name);
      return;
    }
    onMoveFolder(it.id, raw === 'Ungrouped' ? '' : raw);
  };

  const handleLoad = (id: string) => {
    onLoad(id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="tpl-icon-btn"
        title={triggerTitle}
        onClick={() => setIsOpen(true)}
      >
        {triggerIcon}
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
                placeholder="Search by name or folder…"
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
                  <span className="tmpl-rail__count">{grouped.reduce((n, [, rows]) => n + rows.length, 0)}</span>
                </button>
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tmpl-rail__item ${activeKey === f ? 'tmpl-rail__item--active' : ''}`}
                    onClick={() => setActiveKey(f)}
                  >
                    <span className="tmpl-rail__label">{f}</span>
                    <span className="tmpl-rail__count">{grouped.find(([g]) => g === f)?.[1].length || 0}</span>
                  </button>
                ))}
              </nav>

              <div className="tmpl-grid-pane">
              {items.length === 0 ? (
                <div className="tmpl-grid-pane__empty">{emptyText}</div>
              ) : grouped.filter(([f]) => activeKey === ALL_KEY || f === activeKey).length === 0 ? (
                <div className="tmpl-grid-pane__empty">No templates match your search.</div>
              ) : (
                grouped.filter(([f]) => activeKey === ALL_KEY || f === activeKey).map(([folder, rows]) => (
                  <div key={folder}>
                    <h3 className="tmpl-folder-heading">
                      <span>{folder}</span>
                      <span className="tmpl-folder-heading__count">{rows.length}</span>
                    </h3>
                    <ul className="tpl-list">
                      {rows.map((it) => (
                        <li key={it.id} className="tpl-row-wrap">
                          <button
                            type="button"
                            className="tpl-row"
                            onClick={() => handleLoad(it.id)}
                            title="Click to use this template"
                          >
                            <span className="tpl-name">{it.name}</span>
                            {it.meta && (
                              <span
                                className="tpl-info-slot"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                {it.meta}
                              </span>
                            )}
                          </button>
                          {!it.locked && (
                            <select
                              className="tpl-folder-select"
                              value={folderOf(it)}
                              onChange={(e) => handleMove(it, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              title="Move to folder"
                            >
                              {folders.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                              <option value="__new__">New folder…</option>
                            </select>
                          )}
                          <button
                            type="button"
                            className="tpl-delete-btn"
                            onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
                            title="Delete template"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
              </div>
            </div>

            <footer className="tmpl-modal__footer">
              <Button variant="default" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default TemplateBrowser;
