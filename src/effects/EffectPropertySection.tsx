/**
 * Shader Effects System - Effect Property Section
 *
 * A self-contained UI component for the PropertyPanel that allows
 * selecting and previewing shader effects on components.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { EffectName, EffectConfig, TriggerOptions } from './types';
import { effectDefinitions, getEffectDefinition } from './shaderLibrary';
import { useShaderPresetsOptional, ShaderPreset } from './ShaderPresetsContext';
import './EffectPropertySection.css';

// =============================================================================
// TYPES
// =============================================================================

interface EffectPropertySectionProps {
  /** Current effect configuration from component props */
  effectConfig?: EffectConfig;
  /** Component ID for triggering preview */
  componentId: string;
  /** Callback when effect configuration changes */
  onConfigChange: (config: EffectConfig | undefined) => void;
  /** Callback to trigger effect preview */
  onPreview: (componentId: string, effectName: EffectName, options?: TriggerOptions) => void;
  /** Available team colors for 'auto' color selection */
  teamColors?: {
    home: string;
    away: string;
  };
  /** Whether the panel is in compact mode */
  compact?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRIGGER_CONDITIONS = [
  { value: 'increase', label: 'Value Increases' },
  { value: 'decrease', label: 'Value Decreases' },
  { value: 'change', label: 'Any Change' },
  { value: 'equals', label: 'Equals Value' },
] as const;

const COLOR_OPTIONS = [
  { value: 'auto', label: 'Auto (Team Color)' },
  { value: 'home', label: 'Home Team Color' },
  { value: 'away', label: 'Away Team Color' },
  { value: '#ffffff', label: 'White' },
  { value: '#ffff00', label: 'Yellow' },
  { value: '#ff0000', label: 'Red' },
  { value: '#00ff00', label: 'Green' },
  { value: '#00ffff', label: 'Cyan' },
  { value: '#ff00ff', label: 'Magenta' },
  { value: 'custom', label: 'Custom...' },
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function EffectPropertySection({
  effectConfig,
  componentId,
  onConfigChange,
  onPreview,
  teamColors,
  compact = false,
}: EffectPropertySectionProps) {
  const [customColor, setCustomColor] = useState('#ffffff');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#000000');

  // Local state for sliders to allow smooth dragging without triggering re-renders
  const [localDuration, setLocalDuration] = useState<number | null>(null);
  const [localIntensity, setLocalIntensity] = useState<number | null>(null);

  // Get custom shader presets
  const presetsContext = useShaderPresetsOptional();
  const customPresets = presetsContext?.presets || [];

  // Current effect definition
  const currentEffect = useMemo(
    () => getEffectDefinition(effectConfig?.name || 'none'),
    [effectConfig?.name]
  );

  // Check if current effect is a custom preset
  const currentPresetId = effectConfig?.params?.presetId as string | undefined;
  const currentPreset = currentPresetId
    ? customPresets.find(p => p.id === currentPresetId)
    : undefined;

  // Group effects by category
  const effectsByCategory = useMemo(() => {
    const categories: Record<string, typeof effectDefinitions> = {
      score: [],
      transition: [],
      celebration: [],
      ambient: [],
      distortion: [],
    };

    effectDefinitions.forEach((effect) => {
      if (effect.name !== 'none' && categories[effect.category]) {
        categories[effect.category].push(effect);
      }
    });

    return categories;
  }, []);

  // Handle effect selection
  const handleEffectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;

      if (value === 'none') {
        onConfigChange(undefined);
        return;
      }

      // Check if this is a custom preset (starts with 'preset_')
      if (value.startsWith('preset_')) {
        const preset = customPresets.find(p => p.id === value);
        if (preset) {
          onConfigChange({
            name: 'liquidDistortion',
            params: {
              duration: 0, // Continuous
              intensity: 1,
              color: 'auto',
              presetId: preset.id,
              // Store all preset params
              ...preset.params,
            },
          });
          return;
        }
      }

      const newName = value as EffectName;
      const definition = getEffectDefinition(newName);
      onConfigChange({
        name: newName,
        params: {
          duration: definition?.defaultDuration ?? 1.5,
          intensity: definition?.defaultIntensity ?? 1,
          color: 'auto',
        },
      });
    },
    [onConfigChange, customPresets]
  );

  // Handle parameter changes
  const handleParamChange = useCallback(
    (param: string, value: any) => {
      if (!effectConfig) return;

      onConfigChange({
        ...effectConfig,
        params: {
          ...effectConfig.params,
          [param]: value,
        },
      });
    },
    [effectConfig, onConfigChange]
  );

  // Handle trigger changes
  const handleTriggerChange = useCallback(
    (field: string, value: any) => {
      if (!effectConfig) return;

      onConfigChange({
        ...effectConfig,
        trigger: {
          ...effectConfig.trigger,
          path: effectConfig.trigger?.path || '',
          condition: effectConfig.trigger?.condition || 'change',
          [field]: value,
        },
      });
    },
    [effectConfig, onConfigChange]
  );

  // Handle preview button click
  const handlePreview = useCallback(() => {
    console.log('[EffectPropertySection] Preview clicked, effectConfig:', effectConfig);
    if (!effectConfig || effectConfig.name === 'none') {
      console.log('[EffectPropertySection] No effect config or effect is none, returning');
      return;
    }

    // Resolve color based on selection
    let primaryColor = effectConfig.params?.color || '#ffffff';
    if (primaryColor === 'auto' || primaryColor === 'home') {
      primaryColor = teamColors?.home || '#ffffff';
    } else if (primaryColor === 'away') {
      primaryColor = teamColors?.away || '#0000ff';
    } else if (primaryColor === 'custom') {
      primaryColor = customColor;
    }

    let secondaryColor = effectConfig.params?.secondaryColor || '#000000';
    if (secondaryColor === 'auto' || secondaryColor === 'away') {
      secondaryColor = teamColors?.away || '#000000';
    } else if (secondaryColor === 'home') {
      secondaryColor = teamColors?.home || '#ff0000';
    } else if (secondaryColor === 'custom') {
      secondaryColor = customSecondaryColor;
    }

    // Build preset params if this is a custom preset
    let presetParams = undefined;
    if (currentPresetId && effectConfig.params) {
      presetParams = {
        seed: effectConfig.params.seed ?? 0,
        colorShift: effectConfig.params.colorShift ?? 0,
        colorSpeed: effectConfig.params.colorSpeed ?? 0,  // Default to 0 for static colors
        distortionAmount: effectConfig.params.distortionAmount ?? 1,
        noiseScale: effectConfig.params.noiseScale ?? 1,
        speed: effectConfig.params.speed ?? 0.5,
        octaves: effectConfig.params.octaves ?? 5,
        saturation: effectConfig.params.saturation ?? 1,
        brightness: effectConfig.params.brightness ?? 0.8,
        vignette: effectConfig.params.vignette ?? 0.3,
        grain: effectConfig.params.grain ?? 0.03,
        loopDuration: (effectConfig.params as any).loopDuration ?? 4.0,
      };
    }

    console.log('[EffectPropertySection] Calling onPreview:', {
      componentId,
      effectName: effectConfig.name,
      primaryColor,
      secondaryColor,
      presetParams,
    });

    onPreview(componentId, effectConfig.name, {
      duration: effectConfig.params?.duration,
      intensity: effectConfig.params?.intensity,
      primaryColor,
      secondaryColor,
      presetParams,
    });
  }, [effectConfig, componentId, onPreview, teamColors, customColor, customSecondaryColor, currentPresetId]);

  // Render color picker
  const renderColorPicker = (
    label: string,
    value: string | undefined,
    onChange: (value: string) => void,
    customValue: string,
    onCustomChange: (value: string) => void
  ) => {
    const isCustom = value === 'custom';

    return (
      <div className="effect-property-row">
        <label>{label}</label>
        <div className="effect-color-picker">
          <select
            value={value || 'auto'}
            onChange={(e) => onChange(e.target.value)}
            className="effect-select"
          >
            {COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isCustom && (
            <input
              type="color"
              value={customValue}
              onChange={(e) => onCustomChange(e.target.value)}
              className="effect-color-input"
            />
          )}
        </div>
      </div>
    );
  };

  // Determine current select value (could be preset ID or effect name)
  const selectValue = currentPresetId || effectConfig?.name || 'none';

  return (
    <div className={`effect-property-section ${compact ? 'compact' : ''}`}>
      {/* Effect Selector */}
          <div className="effect-property-row">
            <label>Effect</label>
            <select
              value={selectValue}
              onChange={handleEffectChange}
              className="effect-select effect-select-main"
            >
              <option value="none">None</option>
              {customPresets.length > 0 && (
                <optgroup label="Custom Shaders">
                  {customPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Score Events">
                {effectsByCategory.score.map((effect) => (
                  <option key={effect.name} value={effect.name}>
                    {effect.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Transitions">
                {effectsByCategory.transition.map((effect) => (
                  <option key={effect.name} value={effect.name}>
                    {effect.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Celebrations">
                {effectsByCategory.celebration.map((effect) => (
                  <option key={effect.name} value={effect.name}>
                    {effect.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ambient">
                {effectsByCategory.ambient.filter(e => e.name !== 'liquidDistortion').map((effect) => (
                  <option key={effect.name} value={effect.name}>
                    {effect.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Distortion (Text/Content)">
                {effectsByCategory.distortion.map((effect) => (
                  <option key={effect.name} value={effect.name}>
                    {effect.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Effect Description */}
          {currentPreset && (
            <div className="effect-description">Custom liquid shader preset</div>
          )}
          {!currentPreset && currentEffect && currentEffect.name !== 'none' && (
            <div className="effect-description">{currentEffect.description}</div>
          )}

          {/* Effect Parameters */}
          {effectConfig && effectConfig.name !== 'none' && (
            <>
              {/* Duration */}
              <div className="effect-property-row">
                <label>Duration</label>
                <div className="effect-slider-row">
                  <input
                    type="range"
                    min="0.2"
                    max="5"
                    step="0.1"
                    value={localDuration ?? effectConfig.params?.duration ?? currentEffect?.defaultDuration ?? 1.5}
                    onChange={(e) => setLocalDuration(parseFloat(e.target.value))}
                    onMouseUp={() => {
                      if (localDuration !== null) {
                        handleParamChange('duration', localDuration);
                        setLocalDuration(null);
                      }
                    }}
                    onTouchEnd={() => {
                      if (localDuration !== null) {
                        handleParamChange('duration', localDuration);
                        setLocalDuration(null);
                      }
                    }}
                    className="effect-slider"
                  />
                  <span className="effect-slider-value">
                    {(localDuration ?? effectConfig.params?.duration ?? currentEffect?.defaultDuration ?? 1.5).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Intensity */}
              <div className="effect-property-row">
                <label>Intensity</label>
                <div className="effect-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localIntensity ?? effectConfig.params?.intensity ?? 1}
                    onChange={(e) => setLocalIntensity(parseFloat(e.target.value))}
                    onMouseUp={() => {
                      if (localIntensity !== null) {
                        handleParamChange('intensity', localIntensity);
                        setLocalIntensity(null);
                      }
                    }}
                    onTouchEnd={() => {
                      if (localIntensity !== null) {
                        handleParamChange('intensity', localIntensity);
                        setLocalIntensity(null);
                      }
                    }}
                    className="effect-slider"
                  />
                  <span className="effect-slider-value">
                    {(localIntensity ?? effectConfig.params?.intensity ?? 1).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Primary Color */}
              {currentEffect?.supportsColor &&
                renderColorPicker(
                  'Color',
                  effectConfig.params?.color,
                  (v) => handleParamChange('color', v),
                  customColor,
                  setCustomColor
                )}

              {/* Secondary Color */}
              {currentEffect?.supportsSecondaryColor &&
                renderColorPicker(
                  'Secondary Color',
                  effectConfig.params?.secondaryColor,
                  (v) => handleParamChange('secondaryColor', v),
                  customSecondaryColor,
                  setCustomSecondaryColor
                )}

              {/* Trigger Configuration */}
              <div className="effect-trigger-section">
                <div className="effect-trigger-header">Trigger (Optional)</div>

                <div className="effect-property-row">
                  <label>Data Path</label>
                  <input
                    type="text"
                    value={effectConfig.trigger?.path || ''}
                    onChange={(e) => handleTriggerChange('path', e.target.value)}
                    placeholder="e.g., homeTeam.score"
                    className="effect-input"
                  />
                </div>

                <div className="effect-property-row">
                  <label>Condition</label>
                  <select
                    value={effectConfig.trigger?.condition || 'change'}
                    onChange={(e) => handleTriggerChange('condition', e.target.value)}
                    className="effect-select"
                  >
                    {TRIGGER_CONDITIONS.map((cond) => (
                      <option key={cond.value} value={cond.value}>
                        {cond.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Button */}
              <button
                className="effect-preview-button"
                onClick={handlePreview}
                type="button"
              >
                <span className="effect-preview-icon">▶</span>
                Preview Effect
              </button>
            </>
          )}
    </div>
  );
}

export default EffectPropertySection;
