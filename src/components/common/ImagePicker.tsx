import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AVAILABLE_SPORTS,
  Sport,
  getImagePath,
  getRootImages,
  getSubsections,
  getSubsectionImages,
} from '../../utils/imageManifest.generated';
import Button from './Button';
import './ImagePicker.css';

/**
 * Two-pane image picker modeled on DataPathPicker. Left rail lists sport
 * categories (subsections appear as their own rail entries so the rail is
 * flat). Right pane shows thumbnails for the selected category. Click a
 * thumbnail to commit + close.
 *
 * The picker emits the full image PATH (e.g. `/images/Basketball/frame.png`).
 * Callers store this in `imagePath` and set `imageSource: 'local'`.
 */

interface ImageEntry {
  filename: string;
  path: string;
  sport: Sport;
  subsection?: string;
  /** Category label used by the rail (e.g. "Basketball" or "Basketball / Full"). */
  categoryKey: string;
}

interface CategoryEntry {
  /** Unique key — used to drive the rail's active state. */
  key: string;
  /** Display label in the rail. */
  label: string;
  sport: Sport;
  subsection?: string;
  imageCount: number;
}

/**
 * Flatten the sport/subsection tree into a list of categories. Each sport
 * with subsections contributes its root images as one category plus one
 * entry per subsection. Sports without subsections contribute exactly one.
 */
function buildCategories(): CategoryEntry[] {
  const out: CategoryEntry[] = [];
  for (const sport of AVAILABLE_SPORTS) {
    const rootImages = getRootImages(sport);
    if (rootImages.length > 0) {
      out.push({
        key: sport,
        label: sport,
        sport,
        imageCount: rootImages.length,
      });
    }
    for (const subsection of getSubsections(sport)) {
      const subImages = getSubsectionImages(sport, subsection);
      if (subImages.length === 0) continue;
      out.push({
        key: `${sport}::${subsection}`,
        label: `${sport} / ${subsection}`,
        sport,
        subsection,
        imageCount: subImages.length,
      });
    }
  }
  return out;
}

/** Resolve a category key to its image list. */
function imagesForCategory(cat: CategoryEntry): ImageEntry[] {
  const filenames = cat.subsection
    ? getSubsectionImages(cat.sport, cat.subsection)
    : getRootImages(cat.sport);
  return filenames.map(filename => ({
    filename,
    path: getImagePath(filename, cat.sport, cat.subsection),
    sport: cat.sport,
    subsection: cat.subsection,
    categoryKey: cat.key,
  }));
}

export interface ImagePickerProps {
  /** Current image path (e.g. /images/Basketball/frame.png) or empty. */
  value: string | null | undefined;
  /** Called with the chosen image path, or '' if cleared. */
  onChange: (path: string) => void;
  /** Button placeholder when no image is selected. */
  placeholder?: string;
  /** Modal title override. */
  title?: string;
  /** Include a 'No image' / clear option in the footer. */
  allowClear?: boolean;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  placeholder = 'Choose an image…',
  title = 'Select Image',
  allowClear = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(buildCategories, []);
  const allImages = useMemo<ImageEntry[]>(
    () => categories.flatMap(imagesForCategory),
    [categories],
  );

  // The currently-selected image (if any). Drives rail seeding + active highlight.
  const selectedEntry = useMemo(() => {
    if (!value) return undefined;
    return allImages.find(img => img.path === value);
  }, [value, allImages]);

  // Filter categories by search query. A category survives if its label
  // matches OR any of its image filenames matches.
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(cat => {
      if (cat.label.toLowerCase().includes(q)) return true;
      const images = imagesForCategory(cat);
      return images.some(img => img.filename.toLowerCase().includes(q));
    });
  }, [categories, search]);

  // The right pane's image set depends on the active category + search:
  //  - If searching, show only images whose filename matches the query
  //    inside the active category.
  //  - Otherwise show all images for the active category.
  const visibleImages = useMemo<ImageEntry[]>(() => {
    if (!activeKey) return [];
    const cat = categories.find(c => c.key === activeKey);
    if (!cat) return [];
    const base = imagesForCategory(cat);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(img => img.filename.toLowerCase().includes(q));
  }, [activeKey, categories, search]);

  // Seed the active category on open + reset search.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      const seed = selectedEntry?.categoryKey || filteredCategories[0]?.key || null;
      setActiveKey(seed);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // If the search drops the active category, snap to the first match.
  useEffect(() => {
    if (!isOpen) return;
    if (filteredCategories.length === 0) {
      if (activeKey !== null) setActiveKey(null);
      return;
    }
    const stillVisible = filteredCategories.some(c => c.key === activeKey);
    if (!stillVisible) setActiveKey(filteredCategories[0].key);
  }, [isOpen, filteredCategories, activeKey]);

  // Reset scroll on category change.
  useEffect(() => {
    if (gridPaneRef.current) gridPaneRef.current.scrollTop = 0;
  }, [activeKey]);

  const handleSelect = (entry: ImageEntry) => {
    onChange(entry.path);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const activeCategory = filteredCategories.find(c => c.key === activeKey) || null;

  // Trigger display
  const triggerLabel = selectedEntry
    ? selectedEntry.filename
    : (value || placeholder);
  const triggerSub = selectedEntry
    ? (selectedEntry.subsection
        ? `${selectedEntry.sport} / ${selectedEntry.subsection}`
        : selectedEntry.sport)
    : null;

  return (
    <>
      <button
        type="button"
        className={`imgp-trigger ${!value ? 'imgp-trigger--empty' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="imgp-trigger__thumb">
          {value
            ? <img src={value} alt="" />
            : <span className="imgp-trigger__thumb-empty" aria-hidden="true">🖼</span>}
        </span>
        <span className="imgp-trigger__labels">
          <span className="imgp-trigger__title">{triggerLabel}</span>
          {triggerSub && <span className="imgp-trigger__subtitle">{triggerSub}</span>}
        </span>
        <span className="imgp-trigger__chevron" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          className="imgp-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div
            className="imgp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="imgp-modal__header">
              <h2 className="imgp-modal__title">{title}</h2>
              <button
                type="button"
                className="imgp-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="imgp-modal__search-row">
              <input
                ref={searchRef}
                type="text"
                className="imgp-modal__search"
                placeholder="Search by filename or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="imgp-two-pane">
              <nav className="imgp-rail" aria-label="Categories">
                {filteredCategories.length === 0 ? (
                  <div className="imgp-rail__empty">No matches</div>
                ) : (
                  filteredCategories.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      className={`imgp-rail__item ${activeKey === cat.key ? 'imgp-rail__item--active' : ''}`}
                      onClick={() => setActiveKey(cat.key)}
                    >
                      <span className="imgp-rail__label">{cat.label}</span>
                      <span className="imgp-rail__count">{cat.imageCount}</span>
                    </button>
                  ))
                )}
              </nav>

              <div className="imgp-grid-pane" ref={gridPaneRef}>
                {!activeCategory ? (
                  <div className="imgp-grid-pane__empty">No images match your search.</div>
                ) : visibleImages.length === 0 ? (
                  <div className="imgp-grid-pane__empty">No images in this category match.</div>
                ) : (
                  <>
                    <h3 className="imgp-category-heading">
                      <span>{activeCategory.label}</span>
                      <span className="imgp-category-heading__count">{visibleImages.length}</span>
                    </h3>
                    <div className="imgp-grid">
                      {visibleImages.map((img) => {
                        const isSelected = img.path === value;
                        return (
                          <button
                            key={img.path}
                            type="button"
                            className={`imgp-tile ${isSelected ? 'imgp-tile--selected' : ''}`}
                            onClick={() => handleSelect(img)}
                            title={img.filename}
                          >
                            <span className="imgp-tile__thumb">
                              <img src={img.path} alt={img.filename} loading="lazy" />
                            </span>
                            <span className="imgp-tile__filename">{img.filename}</span>
                            {isSelected && <span className="imgp-tile__check" aria-hidden="true">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <footer className="imgp-modal__footer">
              {allowClear && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear Image
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

export default ImagePicker;
