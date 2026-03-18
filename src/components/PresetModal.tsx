import React, { useState, useEffect, useRef } from 'react';
import { LayoutConfig, SlotTemplate, ComponentGroupTemplate } from '../types';
import { useToast } from './Toast';
import { loadTemplates, saveTemplates } from '../utils/slotTemplates';
import { loadComponentTemplates, saveComponentTemplates } from '../utils/componentTemplates';
import './PresetModal.css';

interface PresetModalProps {
  layout: LayoutConfig;
  onClose: () => void;
  onLoadPreset: (layout: LayoutConfig) => void;
  onBackup: () => void;
  onRestore: () => void;
  onTemplatesImported?: () => void;
}

interface SavedPreset {
  id: string;
  name: string;
  layout: LayoutConfig;
  createdAt: string;
  updatedAt: string;
}

const PRESETS_STORAGE_KEY = 'scoreboard-layout-presets';

function PresetModal({ layout, onClose, onLoadPreset, onBackup, onRestore, onTemplatesImported }: PresetModalProps) {
  const toast = useToast();
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState(layout.name || 'My Layout');
  const [activeTab, setActiveTab] = useState<'load' | 'json' | 'templates'>('load');
  const [jsonInput, setJsonInput] = useState('');
  const [slotTemplates, setSlotTemplates] = useState<SlotTemplate[]>([]);
  const [componentTemplates, setComponentTemplates] = useState<ComponentGroupTemplate[]>([]);
  const slotFileInputRef = useRef<HTMLInputElement>(null);
  const componentFileInputRef = useRef<HTMLInputElement>(null);

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
            toast.success('Presets imported successfully!');
          }
        }
      } catch (error) {
        toast.error('Failed to import presets. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  // Export slot templates
  const exportSlotTemplates = () => {
    const templates = loadTemplates();
    if (templates.length === 0) {
      toast.warning('No slot templates to export');
      return;
    }
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slot-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${templates.length} slot template(s)`);
  };

  // Export component templates
  const exportComponentTemplates = () => {
    const templates = loadComponentTemplates();
    if (templates.length === 0) {
      toast.warning('No component templates to export');
      return;
    }
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `component-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${templates.length} component template(s)`);
  };

  // Import slot templates
  const importSlotTemplates = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTemplates: SlotTemplate[] = JSON.parse(e.target?.result as string);
        if (!Array.isArray(importedTemplates)) {
          throw new Error('Invalid format');
        }
        // Validate basic structure
        const isValid = importedTemplates.every(t => t.id && t.name && Array.isArray(t.components));
        if (!isValid) {
          throw new Error('Invalid slot template format');
        }

        const existingTemplates = loadTemplates();
        const existingNames = new Set(existingTemplates.map(t => t.name));

        // Check for duplicates
        const newTemplates = importedTemplates.filter(t => !existingNames.has(t.name));
        const duplicates = importedTemplates.filter(t => existingNames.has(t.name));

        if (duplicates.length > 0 && newTemplates.length === 0) {
          const replace = window.confirm(
            `All ${duplicates.length} template(s) already exist. Replace them?`
          );
          if (replace) {
            // Replace existing with imported versions
            const updatedTemplates = existingTemplates.map(existing => {
              const replacement = importedTemplates.find(t => t.name === existing.name);
              return replacement ? { ...replacement, id: existing.id } : existing;
            });
            saveTemplates(updatedTemplates);
            setSlotTemplates(updatedTemplates);
            toast.success(`Replaced ${duplicates.length} slot template(s)`);
            onTemplatesImported?.();
          }
        } else {
          // Add new templates (skip duplicates)
          const merged = [...existingTemplates, ...newTemplates];
          saveTemplates(merged);
          setSlotTemplates(merged);
          if (duplicates.length > 0) {
            toast.success(`Imported ${newTemplates.length} new slot template(s), skipped ${duplicates.length} duplicate(s)`);
          } else {
            toast.success(`Imported ${newTemplates.length} slot template(s)`);
          }
          onTemplatesImported?.();
        }
      } catch (error) {
        toast.error(`Failed to import slot templates: ${error instanceof Error ? error.message : 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Import component templates
  const importComponentTemplates = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTemplates: ComponentGroupTemplate[] = JSON.parse(e.target?.result as string);
        if (!Array.isArray(importedTemplates)) {
          throw new Error('Invalid format');
        }
        // Validate basic structure
        const isValid = importedTemplates.every(t => t.id && t.name && Array.isArray(t.components));
        if (!isValid) {
          throw new Error('Invalid component template format');
        }

        const existingTemplates = loadComponentTemplates();
        const existingNames = new Set(existingTemplates.map(t => t.name));

        // Check for duplicates
        const newTemplates = importedTemplates.filter(t => !existingNames.has(t.name));
        const duplicates = importedTemplates.filter(t => existingNames.has(t.name));

        if (duplicates.length > 0 && newTemplates.length === 0) {
          const replace = window.confirm(
            `All ${duplicates.length} template(s) already exist. Replace them?`
          );
          if (replace) {
            // Replace existing with imported versions
            const updatedTemplates = existingTemplates.map(existing => {
              const replacement = importedTemplates.find(t => t.name === existing.name);
              return replacement ? { ...replacement, id: existing.id } : existing;
            });
            saveComponentTemplates(updatedTemplates);
            setComponentTemplates(updatedTemplates);
            toast.success(`Replaced ${duplicates.length} component template(s)`);
            onTemplatesImported?.();
          }
        } else {
          // Add new templates (skip duplicates)
          const merged = [...existingTemplates, ...newTemplates];
          saveComponentTemplates(merged);
          setComponentTemplates(merged);
          if (duplicates.length > 0) {
            toast.success(`Imported ${newTemplates.length} new component template(s), skipped ${duplicates.length} duplicate(s)`);
          } else {
            toast.success(`Imported ${newTemplates.length} component template(s)`);
          }
          onTemplatesImported?.();
        }
      } catch (error) {
        toast.error(`Failed to import component templates: ${error instanceof Error ? error.message : 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="preset-tabs">
          <button
            className={`tab ${activeTab === 'load' ? 'active' : ''}`}
            onClick={() => setActiveTab('load')}
          >
            Presets ({savedPresets.length})
          </button>
          <button
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
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
            <div className="load-preset-section">
              <div className="preset-actions">
                <button onClick={onBackup} className="action-btn action-btn-gray">
                  Backup
                </button>
                <button onClick={onRestore} className="action-btn action-btn-green">
                  Restore
                </button>
              </div>

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

          {activeTab === 'templates' && (
            <div className="templates-section">
              <p className="templates-description">
                Export and import templates to share with others or backup your work.
              </p>

              <div className="template-category">
                <h3>Slot Templates ({slotTemplates.length})</h3>
                <p className="template-hint">Used for leaderboard stat rows and repeating elements</p>
                <div className="template-actions">
                  <button
                    onClick={exportSlotTemplates}
                    className="action-btn action-btn-blue"
                    disabled={slotTemplates.length === 0}
                  >
                    Export Slot Templates
                  </button>
                  <button
                    onClick={() => slotFileInputRef.current?.click()}
                    className="action-btn action-btn-green"
                  >
                    Import Slot Templates
                  </button>
                  <input
                    ref={slotFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={importSlotTemplates}
                    style={{ display: 'none' }}
                  />
                </div>
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
                <div className="template-actions">
                  <button
                    onClick={exportComponentTemplates}
                    className="action-btn action-btn-blue"
                    disabled={componentTemplates.length === 0}
                  >
                    Export Component Templates
                  </button>
                  <button
                    onClick={() => componentFileInputRef.current?.click()}
                    className="action-btn action-btn-green"
                  >
                    Import Component Templates
                  </button>
                  <input
                    ref={componentFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={importComponentTemplates}
                    style={{ display: 'none' }}
                  />
                </div>
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