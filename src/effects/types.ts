/**
 * Shader Effects System - Type Definitions
 *
 * This module is self-contained and can be used independently.
 * All types for the WebGL shader effects system are defined here.
 */

// Available shader effect names
// Overlay effects render on top of content
// Distortion effects capture content to texture and transform it
// Generative effects create visual patterns (like liquid)
export type EffectName =
  | 'none'
  // Overlay effects (additive, render on top)
  | 'scoreBurst'
  | 'pulseGlow'
  | 'glitch'
  | 'ripple'
  | 'confetti'
  | 'diagonalWipe'
  | 'radialWipe'
  | 'flash'
  | 'shake'
  // Distortion effects (texture-based, transform content)
  | 'waveDistort'
  | 'shockwave'
  | 'textRipple'
  | 'zoomPulse'
  | 'chromatic'
  | 'pixelate'
  | 'twist'
  // Generative effects (procedural patterns)
  | 'liquidDistortion';

// Check if an effect is a distortion type (requires texture capture)
export const isDistortionEffect = (name: EffectName): boolean => {
  return ['waveDistort', 'shockwave', 'textRipple', 'zoomPulse', 'chromatic', 'pixelate', 'twist'].includes(name);
};

// Check if an effect is generative (creates its own visuals, doesn't transform content)
export const isGenerativeEffect = (name: EffectName): boolean => {
  return ['liquidDistortion'].includes(name);
};

// Effect definition for the registry
export interface EffectDefinition {
  name: EffectName;
  label: string;
  description: string;
  category: 'score' | 'transition' | 'celebration' | 'ambient' | 'distortion';
  defaultDuration: number;
  defaultIntensity: number;
  supportsColor: boolean;
  supportsSecondaryColor: boolean;
}

// Color value - can be hex string or RGBA tuple
export type ColorValue = string | [number, number, number, number];

// Effect configuration stored in component props
export interface EffectConfig {
  name: EffectName;
  trigger?: {
    path: string;           // Data path to watch (e.g., "homeTeam.score")
    condition: 'increase' | 'decrease' | 'change' | 'equals';
    value?: any;            // For 'equals' condition
  };
  params?: {
    duration?: number;      // Effect duration in seconds
    intensity?: number;     // Effect intensity 0-2
    color?: string;         // Primary color (hex or 'auto' for team color)
    secondaryColor?: string; // Secondary color for gradients
    delay?: number;         // Delay before effect starts
  };
}

// Active effect state during animation
export interface ActiveEffect {
  id: string;               // Component ID
  name: EffectName;
  progress: number;         // 0-1 animation progress
  startTime: number;        // performance.now() when started
  duration: number;         // Duration in ms
  intensity: number;
  primaryColor: [number, number, number, number];
  secondaryColor: [number, number, number, number];
  center: [number, number]; // Normalized center point
  presetParams?: {          // Custom preset params for generative effects
    seed: number;
    colorShift: number;
    colorSpeed?: number;
    distortionAmount: number;
    noiseScale: number;
    speed: number;
    octaves: number;
    saturation: number;
    brightness: number;
    vignette: number;
    grain: number;
    loopDuration?: number;
  };
}

// WebGL uniform values passed to shaders
export interface ShaderUniforms {
  u_time: number;
  u_progress: number;
  u_intensity: number;
  u_primaryColor: [number, number, number, number];
  u_secondaryColor: [number, number, number, number];
  u_center: [number, number];
  u_resolution: [number, number];
  // Liquid distortion preset params (optional)
  presetParams?: {
    seed: number;
    colorShift: number;
    colorSpeed?: number;
    distortionAmount: number;
    noiseScale: number;
    speed: number;
    octaves: number;
    saturation: number;
    brightness: number;
    vignette: number;
    grain: number;
    loopDuration?: number;
  };
}

// Props for the ShaderEffectCanvas component
export interface ShaderEffectCanvasProps {
  effect: EffectName;
  active: boolean;
  progress?: number;
  intensity?: number;
  primaryColor?: ColorValue;
  secondaryColor?: ColorValue;
  center?: [number, number];
  width: number;
  height: number;
  children: React.ReactNode;
  onComplete?: () => void;
}

// Context value for effect preview system
export interface EffectPreviewContextValue {
  activeEffects: Map<string, ActiveEffect>;
  triggerEffect: (componentId: string, effectName: EffectName, options?: TriggerOptions) => void;
  stopEffect: (componentId: string) => void;
  stopAllEffects: () => void;
  isEffectActive: (componentId: string) => boolean;
}

// Options when triggering an effect
export interface TriggerOptions {
  duration?: number;
  intensity?: number;
  primaryColor?: ColorValue;
  secondaryColor?: ColorValue;
  center?: [number, number];
  onComplete?: () => void;
  presetParams?: {
    seed: number;
    colorShift: number;
    colorSpeed?: number;
    distortionAmount: number;
    noiseScale: number;
    speed: number;
    octaves: number;
    saturation: number;
    brightness: number;
    vignette: number;
    grain: number;
    loopDuration?: number;
  };
}
