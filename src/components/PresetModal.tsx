import { useState, useEffect } from 'react';
import { LayoutConfig, SlotTemplate, ComponentGroupTemplate } from '../types';
import type { OverlayConfig } from '../shared/utils/overlayTimeline';
import { useToast } from './Toast';
import { loadTemplates } from '../utils/slotTemplates';
import { loadComponentTemplates } from '../utils/componentTemplates';
import {
  listOverlays,
  saveOverlay,
  deleteOverlay,
  loadOverlay as loadSavedOverlay,
  overlayIds,
  SavedOverlay,
} from '../utils/overlayStorage';
import { parseOverlayImport } from '../utils/overlayImport';
import './PresetModal.css';

interface PresetModalProps {
  layout: LayoutConfig;
  onClose: () => void;
  onLoadPreset: (layout: LayoutConfig) => void;
  onLoadOverlay: (overlay: OverlayConfig) => void;
  onBackup: () => void;
  onRestore: () => void;
}

interface SavedPreset {
  id: string;
  name: string;
  layout: LayoutConfig;
  createdAt: string;
  updatedAt: string;
}

const PRESETS_STORAGE_KEY = 'scoreboard-layout-presets';

function PresetModal({ layout, onClose, onLoadPreset, onLoadOverlay, onBackup, onRestore }: PresetModalProps) {
  const toast = useToast();
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState(layout.name || 'My Layout');
  const [activeTab, setActiveTab] = useState<'load' | 'json'>('load');
  const [presetKind, setPresetKind] = useState<'layouts' | 'overlays' | 'templates'>('layouts');
  const [jsonKind, setJsonKind] = useState<'layout' | 'overlay'>('layout');
  const [jsonInput, setJsonInput] = useState('');
  const [savedOverlays, setSavedOverlays] = useState<SavedOverlay[]>([]);
  const [overlayJsonInput, setOverlayJsonInput] = useState('');
  const [slotTemplates, setSlotTemplates] = useState<SlotTemplate[]>([]);
  const [componentTemplates, setComponentTemplates] = useState<ComponentGroupTemplate[]>([]);

  // Load saved presets from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedPresets(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.warn('Failed to parse saved presets:', error);
        setSavedPresets([]);
      }
    }
    // Load templates
    setSlotTemplates(loadTemplates());
    setComponentTemplates(loadComponentTemplates());
    setSavedOverlays(listOverlays());
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) {
      toast.warning('Please enter a preset name');
      return;
    }

    const newPreset: SavedPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      layout: { ...layout },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if preset with same name exists
    const existingIndex = savedPresets.findIndex(p => p.name === newPreset.name);
    let updatedPresets: SavedPreset[];

    if (existingIndex >= 0) {
      // Update existing preset
      const confirmed = window.confirm(`A preset named "${newPreset.name}" already exists. Do you want to overwrite it?`);
      if (!confirmed) return;
      
      updatedPresets = [...savedPresets];
      updatedPresets[existingIndex] = { ...newPreset, id: savedPresets[existingIndex].id, createdAt: savedPresets[existingIndex].createdAt };
    } else {
      // Add new preset
      updatedPresets = [...savedPresets, newPreset];
    }

    setSavedPresets(updatedPresets);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));

    toast.success('Preset saved successfully!');
    setActiveTab('load');
  };

  const loadPreset = (preset: SavedPreset) => {
    const confirmed = window.confirm(`Load preset "${preset.name}"? This will replace your current layout.`);
    if (confirmed) {
      // Load the preset layout but use the preset name as the layout name
      const layoutWithPresetName = {
        ...preset.layout,
        name: preset.name
      };
      onLoadPreset(layoutWithPresetName);
      onClose();
    }
  };

  const deletePreset = (presetId: string, presetName: string) => {
    const confirmed = window.confirm(`Delete preset "${presetName}"? This action cannot be undone.`);
    if (confirmed) {
      const updatedPresets = savedPresets.filter(p => p.id !== presetId);
      setSavedPresets(updatedPresets);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
    }
  };


  const refreshOverlays = () => setSavedOverlays(listOverlays());

  const loadOverlayFromList = (saved: SavedOverlay) => {
    const confirmed = window.confirm(`Load overlay "${saved.name}"? This will replace your current overlay.`);
    if (!confirmed) return;
    const fresh = loadSavedOverlay(saved.id) ?? saved;
    onLoadOverlay(fresh.overlay);
    onClose();
  };

  const deleteOverlayFromList = (saved: SavedOverlay) => {
    const confirmed = window.confirm(`Delete overlay "${saved.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    deleteOverlay(saved.id);
    refreshOverlays();
  };

  const importOverlayText = (text: string, thenLoad = false) => {
    const existing = overlayIds();
    const probe = parseOverlayImport(text, existing, 'copy');
    if (!probe.ok) {
      toast.error(probe.error);
      return;
    }

    let result = probe;
    if (probe.collided) {
      const replace = window.confirm(
        `An overlay with id "${probe.originalId}" already exists.\n\nOK = replace it.\nCancel = import as a copy ("${probe.overlay.id}").`,
      );
      if (replace) {
        const asReplace = parseOverlayImport(text, existing, 'replace');
        if (!asReplace.ok) {
          toast.error(asReplace.error);
          return;
        }
        result = asReplace;
      }
    }

    saveOverlay(result.overlay, new Date().toISOString());
    refreshOverlays();
    setOverlayJsonInput('');
    toast.success(`Imported overlay "${result.overlay.name}"`);

    if (thenLoad) {
      onLoadOverlay(result.overlay);
      onClose();
    }
  };

  const loadFromJson = () => {
    if (!jsonInput.trim()) {
      toast.warning('Please enter JSON layout data');
      return;
    }

    try {
      const layoutData = JSON.parse(jsonInput.trim());
      
      // Basic validation
      if (!layoutData || typeof layoutData !== 'object') {
        throw new Error('Invalid JSON format');
      }
      
      if (!layoutData.name || !layoutData.dimensions || !Array.isArray(layoutData.components)) {
        throw new Error('Missing required fields: name, dimensions, or components');
      }

      const confirmed = window.confirm(`Load layout "${layoutData.name}"? This will replace your current layout.`);
      if (confirmed) {
        // Ensure the layout name from JSON is preserved
        onLoadPreset({
          ...layoutData,
          name: layoutData.name
        });
        onClose();
      }
    } catch (error) {
      toast.error(`Failed to load JSON layout: ${error instanceof Error ? error.message : 'Invalid JSON format'}`);
    }
  };

  return (
    <div className="preset-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preset-modal">
        <div className="preset-modal-header">
          <h2>Preset Manager</h2>
          <div className="preset-modal-header__actions">
            <button onClick={onBackup} className="action-btn action-btn-blue">
              Export All
            </button>
            <button onClick={onRestore} className="action-btn action-btn-green">
              Import All
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="preset-tabs">
          <button
            className={`tab ${activeTab === 'load' ? 'active' : ''}`}
            onClick={() => setActiveTab('load')}
          >
            Presets
          </button>
          <button
            className={`tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            Load JSON
          </button>
        </div>

        <div className="preset-modal-content">
          {activeTab === 'load' && (
            <div className="preset-tabs preset-subtabs">
              <button
                className={`tab ${presetKind === 'layouts' ? 'active' : ''}`}
                onClick={() => setPresetKind('layouts')}
              >
                Layouts ({savedPresets.length})
              </button>
              <button
                className={`tab ${presetKind === 'overlays' ? 'active' : ''}`}
                onClick={() => setPresetKind('overlays')}
              >
                Overlays ({savedOverlays.length})
              </button>
              <button
                className={`tab ${presetKind === 'templates' ? 'active' : ''}`}
                onClick={() => setPresetKind('templates')}
              >
                Templates
              </button>
            </div>
          )}

          {activeTab === 'load' && presetKind === 'layouts' && (
            <div className="load-preset-section">
              {savedPresets.length === 0 ? (
                <div className="no-presets">
                  <p>No saved presets found.</p>
                  <p>Create your first preset by switching to the Save tab.</p>
                </div>
              ) : (
                <div className="presets-grid">
                  {savedPresets
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .map((preset) => (
                    <div key={preset.id} className="preset-card">
                      <button
                        onClick={() => deletePreset(preset.id, preset.name)}
                        className="preset-delete-btn"
                        title="Delete preset"
                      >
                        ×
                      </button>
                      <div className="preset-card-header">
                        <h4>{preset.name}</h4>
                      </div>
                      <div className="preset-card-meta">
                        <span>{(preset.layout.components || []).length} components</span>
                        <span>{preset.layout.dimensions.width}×{preset.layout.dimensions.height}</span>
                        <span className="preset-date">{new Date(preset.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="preset-card-actions">
                        <button
                          onClick={() => loadPreset(preset)}
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
          )}

          {activeTab === 'load' && presetKind === 'templates' && (
            <div className="templates-section">
              <p className="templates-description">
                Templates are bundled into the Export All / Import All file at the top of this modal.
              </p>

              <div className="template-category">
                <h3>Slot Templates ({slotTemplates.length})</h3>
                <p className="template-hint">Used for leaderboard stat rows and repeating elements</p>
                {slotTemplates.length > 0 && (
                  <ul className="template-list">
                    {slotTemplates.map(t => (
                      <li key={t.id}>{t.name} ({t.components.length} components)</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="template-category">
                <h3>Component Templates ({componentTemplates.length})</h3>
                <p className="template-hint">Reusable component groups (clocks, score displays, etc.)</p>
                {componentTemplates.length > 0 && (
                  <ul className="template-list">
                    {componentTemplates.map(t => (
                      <li key={t.id}>{t.name} ({t.components.length} components)</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'load' && presetKind === 'overlays' && (
            <div className="load-preset-section">
              {savedOverlays.length === 0 ? (
                <div className="no-presets">
                  <p>No saved overlays found.</p>
                  <p>Import one from the Load JSON tab, or create a new overlay from the Overlays button in the header.</p>
                </div>
              ) : (
                <div className="presets-grid">
                  {savedOverlays
                    .slice()
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .map((saved) => (
                      <div key={saved.id} className="preset-card">
                        <button
                          onClick={() => deleteOverlayFromList(saved)}
                          className="preset-delete-btn"
                          title="Delete overlay"
                        >
                          ×
                        </button>
                        <div className="preset-card-header">
                          <h4>{saved.name}</h4>
                        </div>
                        <div className="preset-card-meta">
                          <span>{(saved.overlay.components || []).length} components</span>
                          <span>{saved.overlay.dimensions.width}×{saved.overlay.dimensions.height}</span>
                          <span className="preset-date">{new Date(saved.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="preset-card-actions">
                          <button
                            onClick={() => loadOverlayFromList(saved)}
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
          )}

          {activeTab === 'json' && (
            <div className="json-input-section">
              <div className="input-group">
                <label htmlFor="json-kind">Type:</label>
                <select
                  id="json-kind"
                  value={jsonKind}
                  onChange={(e) => setJsonKind(e.target.value as 'layout' | 'overlay')}
                  className="json-kind-select"
                >
                  <option value="layout">Layout</option>
                  <option value="overlay">Overlay</option>
                </select>
              </div>

              <div className="input-group">
                <label>{jsonKind === 'layout' ? 'Paste JSON Layout:' : 'Paste JSON Overlay:'}</label>
                <textarea
                  value={jsonKind === 'layout' ? jsonInput : overlayJsonInput}
                  onChange={(e) =>
                    jsonKind === 'layout'
                      ? setJsonInput(e.target.value)
                      : setOverlayJsonInput(e.target.value)
                  }
                  placeholder={
                    jsonKind === 'layout'
                      ? 'Paste your JSON layout here...'
                      : 'Paste a single exported overlay here...'
                  }
                  className="json-textarea"
                  rows={12}
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  onClick={() =>
                    jsonKind === 'layout' ? loadFromJson() : importOverlayText(overlayJsonInput, true)
                  }
                  className="load-button"
                >
                  {jsonKind === 'layout' ? 'Load Layout' : 'Load Overlay'}
                </button>
                <button
                  onClick={() => (jsonKind === 'layout' ? setJsonInput('') : setOverlayJsonInput(''))}
                  className="clear-button"
                >
                  Clear
                </button>
                <button onClick={onClose} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PresetModal;