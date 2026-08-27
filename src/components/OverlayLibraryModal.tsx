import { useState, useEffect, useCallback } from 'react';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';
import { useToast } from './Toast';
import {
  listOverlays,
  saveOverlay,
  deleteOverlay,
  newOverlay,
  loadOverlay as loadSavedOverlay,
  SavedOverlay,
  DEFAULT_OVERLAY_FPS,
  DEFAULT_OVERLAY_LENGTH_FRAMES,
  MIN_OVERLAY_FPS,
  MAX_OVERLAY_FPS,
  MIN_OVERLAY_LENGTH_FRAMES,
  maxOverlayLengthFrames,
} from '../utils/overlayStorage';
import './PresetModal.css';

interface OverlayLibraryModalProps {
  dimensions: { width: number; height: number };
  onClose: () => void;
  onLoadOverlay: (overlay: OverlayConfig) => void;
}

function OverlayLibraryModal({ dimensions, onClose, onLoadOverlay }: OverlayLibraryModalProps) {
  const toast = useToast();
  const [savedOverlays, setSavedOverlays] = useState<SavedOverlay[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('Untitled Overlay');
  const [newIsTransition, setNewIsTransition] = useState(false);
  const [newFps, setNewFps] = useState(String(DEFAULT_OVERLAY_FPS));
  const [newLength, setNewLength] = useState(String(DEFAULT_OVERLAY_LENGTH_FRAMES));

  const refresh = useCallback(() => {
    setSavedOverlays(listOverlays());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const beginCreate = () => {
    setNewName('Untitled Overlay');
    setNewIsTransition(false);
    setNewFps(String(DEFAULT_OVERLAY_FPS));
    setNewLength(String(DEFAULT_OVERLAY_LENGTH_FRAMES));
    setCreating(true);
  };

  const parsedFps = parseInt(newFps, 10);
  const lengthCap = maxOverlayLengthFrames(
    Number.isFinite(parsedFps) ? Math.min(MAX_OVERLAY_FPS, Math.max(MIN_OVERLAY_FPS, parsedFps)) : DEFAULT_OVERLAY_FPS,
  );

  const createOverlay = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.warning('Please enter an overlay name');
      return;
    }

    const created = newOverlay(trimmed, dimensions, {
      isTransition: newIsTransition,
      fps: parsedFps,
      lengthFrames: parseInt(newLength, 10),
    });
    saveOverlay(created, new Date().toISOString());
    refresh();
    onLoadOverlay(created);
    onClose();
  };

  const loadOverlay = (saved: SavedOverlay) => {
    const confirmed = window.confirm(`Load overlay "${saved.name}"? This will replace your current overlay.`);
    if (!confirmed) return;
    const fresh = loadSavedOverlay(saved.id) ?? saved;
    onLoadOverlay(fresh.overlay);
    onClose();
  };

  const removeOverlay = (saved: SavedOverlay) => {
    const confirmed = window.confirm(`Delete overlay "${saved.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    deleteOverlay(saved.id);
    refresh();
  };

  return (
    <div className="preset-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preset-modal">
        <div className="preset-modal-header">
          <h2>Overlay Library</h2>
          <div className="preset-modal-header__actions">
            <button onClick={beginCreate} className="action-btn action-btn-green">
              New Overlay
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="preset-modal-content">
          {creating && (
            <div className="overlay-create-form">
              <label className="overlay-create-field">
                <span>Name</span>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createOverlay();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                />
              </label>
              <div className="overlay-create-row">
                <label className="overlay-create-field overlay-create-field-narrow">
                  <span>FPS</span>
                  <input
                    type="number"
                    min={MIN_OVERLAY_FPS}
                    max={MAX_OVERLAY_FPS}
                    value={newFps}
                    onChange={(e) => setNewFps(e.target.value)}
                  />
                </label>
                <label className="overlay-create-field overlay-create-field-narrow">
                  <span>Frames</span>
                  <input
                    type="number"
                    min={MIN_OVERLAY_LENGTH_FRAMES}
                    max={lengthCap}
                    value={newLength}
                    onChange={(e) => setNewLength(e.target.value)}
                  />
                </label>
              </div>
              <label className="overlay-create-check">
                <input
                  type="checkbox"
                  checked={newIsTransition}
                  onChange={(e) => setNewIsTransition(e.target.checked)}
                />
                <span>Transition overlay</span>
              </label>
              <p className="overlay-create-hint">
                A transition overlay plays over a layout change and gets a switch frame on its timeline.
              </p>
              <div className="overlay-create-actions">
                <button onClick={createOverlay} className="action-btn action-btn-green">Create</button>
                <button onClick={() => setCreating(false)} className="action-btn action-btn-gray">Cancel</button>
              </div>
            </div>
          )}
          <div className="load-preset-section">
            {savedOverlays.length === 0 ? (
              <div className="no-presets">
                <p>No saved overlays found.</p>
                <p>Create your first overlay with the button above.</p>
              </div>
            ) : (
              <div className="presets-grid">
                {savedOverlays
                  .slice()
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((saved) => (
                    <div key={saved.id} className="preset-card">
                      <button
                        onClick={() => removeOverlay(saved)}
                        className="preset-delete-btn"
                        title="Delete overlay"
                      >
                        ×
                      </button>
                      <div className="preset-card-header">
                        <h4>{saved.name}</h4>
                      </div>
                      <div className="preset-card-meta">
                        <span>{saved.overlay.components.length} components</span>
                        <span>{saved.overlay.dimensions.width}×{saved.overlay.dimensions.height}</span>
                        <span className="preset-date">{new Date(saved.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="preset-card-actions">
                        <button
                          onClick={() => loadOverlay(saved)}
                          className="load-button"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverlayLibraryModal;
