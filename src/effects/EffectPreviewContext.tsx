/**
 * Shader Effects System - Effect Preview Context
 *
 * Provides a React context for managing and triggering shader effects.
 * Components can use this to preview effects without modifying their props.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  EffectName,
  ActiveEffect,
  EffectPreviewContextValue,
  TriggerOptions,
} from './types';
import { toRgba } from './webglUtils';
import { getEffectDefinition } from './shaderLibrary';

// =============================================================================
// CONTEXT
// =============================================================================

const EffectPreviewContext = createContext<EffectPreviewContextValue | null>(null);

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface EffectPreviewProviderProps {
  children: React.ReactNode;
}

export function EffectPreviewProvider({ children }: EffectPreviewProviderProps) {
  const [activeEffects, setActiveEffects] = useState<Map<string, ActiveEffect>>(
    new Map()
  );
  const animationFrameRef = useRef<number>(0);
  const callbacksRef = useRef<Map<string, () => void>>(new Map());

  // Animation loop to update effect progress
  const updateEffects = useCallback(() => {
    const now = performance.now();
    let hasActiveEffects = false;

    setActiveEffects((prev) => {
      const next = new Map<string, ActiveEffect>();

      prev.forEach((effect, id) => {
        const elapsed = now - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1);

        if (progress < 1) {
          next.set(id, { ...effect, progress });
          hasActiveEffects = true;
        } else {
          // Effect completed - trigger callback
          const callback = callbacksRef.current.get(id);
          if (callback) {
            callback();
            callbacksRef.current.delete(id);
          }
        }
      });

      return next;
    });

    if (hasActiveEffects) {
      animationFrameRef.current = requestAnimationFrame(updateEffects);
    } else {
      animationFrameRef.current = 0;
    }
  }, []);

  // Start animation loop when effects are active
  useEffect(() => {
    if (activeEffects.size > 0 && animationFrameRef.current === 0) {
      animationFrameRef.current = requestAnimationFrame(updateEffects);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };
  }, [activeEffects.size, updateEffects]);

  // Trigger an effect on a component
  const triggerEffect = useCallback(
    (componentId: string, effectName: EffectName, options: TriggerOptions = {}) => {
      if (effectName === 'none') return;

      const definition = getEffectDefinition(effectName);
      let duration = (options.duration ?? definition?.defaultDuration ?? 1.5) * 1000;
      const intensity = options.intensity ?? definition?.defaultIntensity ?? 1;

      // For generative effects with no duration, keep them running indefinitely
      if (effectName === 'liquidDistortion' && duration === 0) {
        duration = 999999999; // Effectively infinite
      }

      const effect: ActiveEffect = {
        id: componentId,
        name: effectName,
        progress: 0,
        startTime: performance.now(),
        duration,
        intensity,
        primaryColor: toRgba(options.primaryColor, [1, 1, 1, 1]),
        secondaryColor: toRgba(options.secondaryColor, [0, 0, 0, 1]),
        center: options.center ?? [0.5, 0.5],
        presetParams: options.presetParams,
      };

      // Store completion callback
      if (options.onComplete) {
        callbacksRef.current.set(componentId, options.onComplete);
      }

      setActiveEffects((prev) => {
        const next = new Map(prev);
        next.set(componentId, effect);
        return next;
      });

      // Start animation if not running
      if (animationFrameRef.current === 0) {
        animationFrameRef.current = requestAnimationFrame(updateEffects);
      }
    },
    [updateEffects]
  );

  // Stop a specific effect
  const stopEffect = useCallback((componentId: string) => {
    setActiveEffects((prev) => {
      const next = new Map(prev);
      next.delete(componentId);
      return next;
    });
    callbacksRef.current.delete(componentId);
  }, []);

  // Stop all effects
  const stopAllEffects = useCallback(() => {
    setActiveEffects(new Map());
    callbacksRef.current.clear();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
  }, []);

  // Check if an effect is active on a component
  const isEffectActive = useCallback(
    (componentId: string) => {
      return activeEffects.has(componentId);
    },
    [activeEffects]
  );

  const value: EffectPreviewContextValue = {
    activeEffects,
    triggerEffect,
    stopEffect,
    stopAllEffects,
    isEffectActive,
  };

  return (
    <EffectPreviewContext.Provider value={value}>
      {children}
    </EffectPreviewContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access the effect preview context
 */
export function useEffectPreview(): EffectPreviewContextValue {
  const context = useContext(EffectPreviewContext);
  if (!context) {
    throw new Error('useEffectPreview must be used within an EffectPreviewProvider');
  }
  return context;
}

/**
 * Hook to get the active effect for a specific component
 */
export function useActiveEffect(componentId: string): ActiveEffect | undefined {
  const { activeEffects } = useEffectPreview();
  return activeEffects.get(componentId);
}

/**
 * Hook to trigger effects on a component
 * Returns a function that can be called to trigger the effect
 */
export function useEffectTrigger(
  componentId: string,
  effectName: EffectName,
  options?: TriggerOptions
) {
  const { triggerEffect } = useEffectPreview();

  return useCallback(() => {
    triggerEffect(componentId, effectName, options);
  }, [triggerEffect, componentId, effectName, options]);
}

// =============================================================================
// STANDALONE HOOK (for use outside provider)
// =============================================================================

/**
 * Standalone hook for managing effects without a provider
 * Useful for isolated components or testing
 */
export function useStandaloneEffectPreview() {
  const [activeEffects, setActiveEffects] = useState<Map<string, ActiveEffect>>(
    new Map()
  );
  const animationFrameRef = useRef<number>(0);
  const effectsRef = useRef<Map<string, ActiveEffect>>(new Map());

  // Keep ref in sync with state for animation loop access
  useEffect(() => {
    effectsRef.current = activeEffects;
  }, [activeEffects]);

  // Animation loop function
  const runAnimationLoop = useCallback(() => {
    const animate = () => {
      const now = performance.now();
      const currentEffects = effectsRef.current;

      if (currentEffects.size === 0) {
        animationFrameRef.current = 0;
        return;
      }

      const next = new Map<string, ActiveEffect>();

      currentEffects.forEach((effect, id) => {
        const elapsed = now - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1);

        if (progress < 1) {
          next.set(id, { ...effect, progress });
        }
      });

      setActiveEffects(next);
      effectsRef.current = next;

      if (next.size > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = 0;
      }
    };

    if (animationFrameRef.current === 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const triggerEffect = useCallback(
    (componentId: string, effectName: EffectName, options: TriggerOptions = {}) => {
      if (effectName === 'none') return;

      const definition = getEffectDefinition(effectName);
      const duration = (options.duration ?? definition?.defaultDuration ?? 1.5) * 1000;

      const effect: ActiveEffect = {
        id: componentId,
        name: effectName,
        progress: 0,
        startTime: performance.now(),
        duration,
        intensity: options.intensity ?? 1,
        primaryColor: toRgba(options.primaryColor, [1, 1, 1, 1]),
        secondaryColor: toRgba(options.secondaryColor, [0, 0, 0, 1]),
        center: options.center ?? [0.5, 0.5],
        presetParams: options.presetParams,
      };

      // For generative effects with no duration, keep them running
      if (effectName === 'liquidDistortion' && duration === 0) {
        effect.duration = 999999999; // Effectively infinite
      }

      setActiveEffects((prev) => {
        const next = new Map(prev);
        next.set(componentId, effect);
        effectsRef.current = next;
        return next;
      });

      // Start animation loop if not running
      runAnimationLoop();
    },
    [runAnimationLoop]
  );

  const stopEffect = useCallback((componentId: string) => {
    setActiveEffects((prev) => {
      const next = new Map(prev);
      next.delete(componentId);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    activeEffects,
    triggerEffect,
    stopEffect,
    isEffectActive: (id: string) => activeEffects.has(id),
  };
}

export default EffectPreviewContext;
