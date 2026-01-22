/**
 * Shader Presets Context
 *
 * Manages custom shader presets created in the Shader Creator.
 * Presets are stored in localStorage and available in the effects dropdown.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Available noise types
export type NoiseType = 'simplex' | 'perlin' | 'value' | 'voronoi' | 'white' | 'worley';

// Shader preset parameters (matches ShaderCreator params)
export interface ShaderPresetParams {
  seed: number;
  colorShift: number;
  colorSpeed: number;  // Speed of color/hue animation (0 = static colors)
  distortionAmount: number;
  noiseScale: number;
  speed: number;
  octaves: number;
  saturation: number;
  brightness: number;
  vignette: number;
  grain: number;
  noiseType: NoiseType;  // Type of noise function to use
  cellSize?: number;      // For voronoi/worley: size of cells
  cellEdge?: number;      // For voronoi: edge detection strength
  loopDuration?: number;  // Loop duration in seconds for seamless animation
}

// A saved shader preset
export interface ShaderPreset {
  id: string;
  name: string;
  params: ShaderPresetParams;
  createdAt: string;
  updatedAt: string;
}

// Context value
interface ShaderPresetsContextValue {
  presets: ShaderPreset[];
  savePreset: (name: string, params: ShaderPresetParams) => ShaderPreset;
  deletePreset: (id: string) => void;
  updatePreset: (id: string, name: string, params: ShaderPresetParams) => void;
  getPreset: (id: string) => ShaderPreset | undefined;
}

const STORAGE_KEY = 'shader-creator-presets';

const ShaderPresetsContext = createContext<ShaderPresetsContextValue | null>(null);

export function ShaderPresetsProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<ShaderPreset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPresets(parsed);
        }
      }
    } catch (e) {
      console.error('[ShaderPresetsContext] Failed to load presets:', e);
    }
  }, []);

  // Save presets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('[ShaderPresetsContext] Failed to save presets:', e);
    }
  }, [presets]);

  const savePreset = useCallback((name: string, params: ShaderPresetParams): ShaderPreset => {
    const now = new Date().toISOString();
    const newPreset: ShaderPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      params,
      createdAt: now,
      updatedAt: now,
    };

    setPresets(prev => [...prev, newPreset]);
    return newPreset;
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePreset = useCallback((id: string, name: string, params: ShaderPresetParams) => {
    setPresets(prev => prev.map(p =>
      p.id === id
        ? { ...p, name, params, updatedAt: new Date().toISOString() }
        : p
    ));
  }, []);

  const getPreset = useCallback((id: string): ShaderPreset | undefined => {
    return presets.find(p => p.id === id);
  }, [presets]);

  return (
    <ShaderPresetsContext.Provider value={{ presets, savePreset, deletePreset, updatePreset, getPreset }}>
      {children}
    </ShaderPresetsContext.Provider>
  );
}

export function useShaderPresets(): ShaderPresetsContextValue {
  const context = useContext(ShaderPresetsContext);
  if (!context) {
    throw new Error('useShaderPresets must be used within a ShaderPresetsProvider');
  }
  return context;
}

// Hook to safely use presets (returns empty array if outside provider)
export function useShaderPresetsOptional(): ShaderPresetsContextValue | null {
  return useContext(ShaderPresetsContext);
}

export default ShaderPresetsContext;
