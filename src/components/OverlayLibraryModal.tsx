import { useState, useEffect, useCallback } from 'react';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';
import { useToast } from './Toast';
import { listOverlays, saveOverlay, deleteOverlay, newOverlay, loadOverlay as loadSavedOverlay, SavedOverlay } from '../utils/overlayStorage';
import './PresetModal.css';

interface OverlayLibraryModalProps {
  dimensions: { width: number; height: number };
  onClose: () => void;
  onLoadOverlay: (overlay: OverlayConfig) => void;
}

function OverlayLibraryModal({ dimensions, onClose, onLoadOverlay }: OverlayLibraryModalProps) {
  const toast = useToast();
  const [savedOverlays, setSavedOverlays] = useState<SavedOverlay[]>([]);

  const refresh = useCallback(() => {
    setSavedOverlays(listOverlays());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createOverlay = () => {
    const name = window.prompt('Name the new overlay:', 'Untitled Overlay');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning('Please enter an overlay name');
      return;
    }

    const created = newOverlay(trimmed, dimensions);
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
            <button onClick={createOverlay} className="action-btn action-btn-green">
              New Overlay
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="preset-modal-content">
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
