import React, { useState, useEffect } from 'react';
import { LayoutConfig } from '../types';
import './PresetModal.css';

interface PresetModalProps {
  layout: LayoutConfig;
  onClose: () => void;
  onLoadPreset: (layout: LayoutConfig) => void;
}

interface SavedPreset {
  id: string;
  name: string;
  layout: LayoutConfig;
  createdAt: string;
  updatedAt: string;
}

const PRESETS_STORAGE_KEY = 'scoreboard-layout-presets';

function PresetModal({ layout, onClose, onLoadPreset }: PresetModalProps) {
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState(layout.name || 'My Layout');
  const [activeTab, setActiveTab] = useState<'save' | 'load' | 'json'>('save');
  const [jsonInput, setJsonInput] = useState('');

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
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
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
    
    alert('Preset saved successfully!');
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

  const exportPresets = () => {
    const dataStr = JSON.stringify(savedPresets, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'scoreboard-presets.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedPresets = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedPresets)) {
          const confirmed = window.confirm('Import presets? This will add to your existing presets.');
          if (confirmed) {
            const updatedPresets = [...savedPresets, ...importedPresets];
            setSavedPresets(updatedPresets);
            localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
            alert('Presets imported successfully!');
          }
        }
      } catch (error) {
        alert('Failed to import presets. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };


  const loadFromJson = () => {
    if (!jsonInput.trim()) {
      alert('Please enter JSON layout data');
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
      alert(`Failed to load JSON layout: ${error instanceof Error ? error.message : 'Invalid JSON format'}`);
    }
  };

  return (
    <div className="preset-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preset-modal">
        <div className="preset-modal-header">
          <h2>Preset Manager</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="preset-tabs">
          <button 
            className={`tab ${activeTab === 'save' ? 'active' : ''}`}
            onClick={() => setActiveTab('save')}
          >
            Save Preset
          </button>
          <button 
            className={`tab ${activeTab === 'load' ? 'active' : ''}`}
            onClick={() => setActiveTab('load')}
          >
            Load Preset ({savedPresets.length})
          </button>
          <button 
            className={`tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            Load JSON
          </button>
        </div>

        <div className="preset-modal-content">
          {activeTab === 'save' && (
            <div className="save-preset-section">
              <div className="input-group">
                <label>Preset Name:</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Enter preset name..."
                  className="preset-name-input"
                  autoFocus
                />
              </div>
              
              <div className="layout-preview">
                <h4>Current Layout Info:</h4>
                <div className="layout-info">
                  <div><strong>Name:</strong> {layout.name}</div>
                  <div><strong>Sport:</strong> {layout.sport}</div>
                  <div><strong>Components:</strong> {(layout.components || []).length}</div>
                  <div><strong>Dimensions:</strong> {layout.dimensions.width} × {layout.dimensions.height}</div>
                  <div><strong>Background:</strong> {layout.backgroundColor}</div>
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={savePreset} className="save-button">
                  Save Preset
                </button>
                <button onClick={onClose} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeTab === 'load' && (
            <div className="load-preset-section">
              <div className="preset-actions">
                <button onClick={exportPresets} className="export-button" disabled={savedPresets.length === 0}>
                  Export All Presets
                </button>
                <label className="import-button">
                  Import Presets
                  <input
                    type="file"
                    accept=".json"
                    onChange={importPresets}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {savedPresets.length === 0 ? (
                <div className="no-presets">
                  <p>No saved presets found.</p>
                  <p>Create your first preset by switching to the Save tab.</p>
                </div>
              ) : (
                <div className="presets-list">
                  {savedPresets
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .map((preset) => (
                    <div key={preset.id} className="preset-item">
                      <div className="preset-info">
                        <h4>{preset.name}</h4>
                        <div className="preset-details">
                          <span>{preset.layout.sport}</span>
                          <span>{(preset.layout.components || []).length} components</span>
                          <span>{preset.layout.dimensions.width}×{preset.layout.dimensions.height}</span>
                        </div>
                        <div className="preset-date">
                          Updated: {new Date(preset.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="preset-actions">
                        <button
                          onClick={() => loadPreset(preset)}
                          className="load-button"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deletePreset(preset.id, preset.name)}
                          className="delete-button"
                        >
                          Delete
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
                <label>Paste JSON Layout:</label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste your JSON layout here..."
                  className="json-textarea"
                  rows={12}
                  autoFocus
                />
              </div>
          
              <div className="modal-actions">
                <button onClick={loadFromJson} className="load-button">
                  Load Layout
                </button>
                <button onClick={() => setJsonInput('')} className="clear-button">
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