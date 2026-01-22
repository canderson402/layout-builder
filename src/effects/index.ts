/**
 * Shader Effects System
 *
 * A self-contained WebGL shader effects module for the layout builder.
 * Provides visual effects that can be applied to scoreboard components.
 *
 * Usage:
 * 1. Wrap your app with EffectPreviewProvider
 * 2. Use EffectPropertySection in PropertyPanel for configuration
 * 3. Use ShaderEffectCanvas to wrap components that need effects
 * 4. Use useEffectPreview() hook to trigger effects programmatically
 *
 * @example
 * ```tsx
 * import {
 *   EffectPreviewProvider,
 *   EffectPropertySection,
 *   ShaderEffectCanvas,
 *   useEffectPreview,
 * } from './effects';
 *
 * // In your app root:
 * <EffectPreviewProvider>
 *   <App />
 * </EffectPreviewProvider>
 *
 * // In a component:
 * const { triggerEffect, activeEffects } = useEffectPreview();
 * triggerEffect('component-id', 'scoreBurst', { primaryColor: '#ff0000' });
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  EffectName,
  EffectDefinition,
  EffectConfig,
  ActiveEffect,
  TriggerOptions,
  ShaderUniforms,
  ColorValue,
  EffectPreviewContextValue,
  ShaderEffectCanvasProps,
} from './types';

export { isDistortionEffect, isGenerativeEffect } from './types';

// =============================================================================
// SHADER LIBRARY
// =============================================================================

export {
  // Shader sources
  vertexShader,
  fragmentShaders,
  // Effect definitions
  effectDefinitions,
  getEffectDefinition,
  getEffectsByCategory,
} from './shaderLibrary';

// =============================================================================
// WEBGL UTILITIES
// =============================================================================

export {
  // WebGL context management
  initWebGL,
  setUniforms,
  updateTexture,
  render,
  destroyWebGL,
  // Color utilities
  hexToRgba,
  toRgba,
  // DOM capture
  captureElement,
  captureCanvas,
} from './webglUtils';

export type { WebGLContext } from './webglUtils';

// =============================================================================
// REACT COMPONENTS
// =============================================================================

export { ShaderEffectCanvas } from './ShaderEffectCanvas';
export { default as ShaderEffectCanvasDefault } from './ShaderEffectCanvas';

export { DistortionEffectCanvas } from './DistortionEffectCanvas';
export { default as DistortionEffectCanvasDefault } from './DistortionEffectCanvas';

export { GenerativeEffectCanvas } from './GenerativeEffectCanvas';
export { default as GenerativeEffectCanvasDefault } from './GenerativeEffectCanvas';

export { EffectPropertySection } from './EffectPropertySection';
export { default as EffectPropertySectionDefault } from './EffectPropertySection';

// =============================================================================
// CONTEXT & HOOKS
// =============================================================================

export {
  EffectPreviewProvider,
  useEffectPreview,
  useActiveEffect,
  useEffectTrigger,
  useStandaloneEffectPreview,
} from './EffectPreviewContext';

export { default as EffectPreviewContext } from './EffectPreviewContext';

// =============================================================================
// SHADER PRESETS (Custom shader storage)
// =============================================================================

export {
  ShaderPresetsProvider,
  useShaderPresets,
  useShaderPresetsOptional,
} from './ShaderPresetsContext';

export type {
  ShaderPreset,
  ShaderPresetParams,
  NoiseType,
} from './ShaderPresetsContext';

export { default as ShaderPresetsContext } from './ShaderPresetsContext';
