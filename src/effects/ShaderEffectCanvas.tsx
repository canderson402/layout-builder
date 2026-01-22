/**
 * Shader Effects System - ShaderEffectCanvas Component
 *
 * Renders WebGL shader effects as an overlay on top of content.
 * This approach keeps the original content visible and adds effects on top.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { EffectName, ShaderUniforms } from './types';
import {
  WebGLContext,
  initWebGL,
  setUniforms,
  render,
  destroyWebGL,
  toRgba,
} from './webglUtils';

export interface ShaderEffectCanvasProps {
  /** The shader effect to apply */
  effect: EffectName;
  /** Whether the effect is currently active */
  active: boolean;
  /** Animation progress (0-1) */
  progress?: number;
  /** Effect intensity (0-2, default 1) */
  intensity?: number;
  /** Primary effect color */
  primaryColor?: string | [number, number, number, number];
  /** Secondary effect color (for gradients) */
  secondaryColor?: string | [number, number, number, number];
  /** Effect center point (normalized 0-1) */
  center?: [number, number];
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Content to apply effect to */
  children: React.ReactNode;
  /** CSS class for container */
  className?: string;
  /** Inline styles for container */
  style?: React.CSSProperties;
}

// Device pixel ratio for crisp rendering
const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

export function ShaderEffectCanvas({
  effect,
  active,
  progress = 0,
  intensity = 1,
  primaryColor = '#ffffff',
  secondaryColor = '#000000',
  center = [0.5, 0.5],
  width,
  height,
  children,
  className,
  style,
}: ShaderEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLContext | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  // Memoize colors
  const primaryColorRgba = useMemo(() => toRgba(primaryColor), [primaryColor]);
  const secondaryColorRgba = useMemo(() => toRgba(secondaryColor), [secondaryColor]);

  // Render canvas when active and effect is not none (so WebGL can initialize)
  const shouldRenderCanvas = active && effect !== 'none';

  // Initialize WebGL when effect changes or canvas appears in DOM
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effect === 'none' || !shouldRenderCanvas) {
      setIsInitialized(false);
      return;
    }

    // Clean up previous context
    if (glContextRef.current) {
      destroyWebGL(glContextRef.current);
      glContextRef.current = null;
    }

    // Initialize new context with selected shader
    const ctx = initWebGL(canvas, effect);
    if (ctx) {
      glContextRef.current = ctx;
      setIsInitialized(true);
    } else {
      console.error('[ShaderEffectCanvas] Failed to initialize WebGL');
    }

    return () => {
      if (glContextRef.current) {
        destroyWebGL(glContextRef.current);
        glContextRef.current = null;
      }
    };
  }, [effect, shouldRenderCanvas]);

  // Render frame - effects render as overlay (no texture capture needed)
  const renderFrame = useCallback(
    (currentProgress: number, time: number) => {
      const glContext = glContextRef.current;
      const canvas = canvasRef.current;

      if (!glContext || !canvas) {
        console.log('[ShaderEffectCanvas] No context or canvas');
        return;
      }

      // Set uniforms - no texture needed for overlay effects
      const uniforms: ShaderUniforms = {
        u_time: time / 1000,
        u_progress: currentProgress,
        u_intensity: intensity,
        u_primaryColor: primaryColorRgba,
        u_secondaryColor: secondaryColorRgba,
        u_center: center,
        u_resolution: [width * DPR, height * DPR],
      };

      setUniforms(glContext, uniforms);

      // Render
      render(glContext, width * DPR, height * DPR);
    },
    [intensity, primaryColorRgba, secondaryColorRgba, center, width, height]
  );

  // Render when progress changes externally (progress is managed by EffectPreviewContext)
  useEffect(() => {
    if (!active || effect === 'none' || !isInitialized) {
      return;
    }

    // Progress is provided externally from EffectPreviewContext - render the current frame
    // Progress goes from 0 to 1, so we render at all values including 0
    if (progress !== undefined) {
      renderFrame(progress, performance.now());
    }
  }, [active, effect, isInitialized, progress, renderFrame]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Content layer - always visible */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
        }}
      >
        {children}
      </div>

      {/* WebGL effect overlay - renders on TOP of content */}
      {/* Canvas must be in DOM for WebGL to initialize, opacity controls visibility */}
      {shouldRenderCanvas && (
        <canvas
          ref={canvasRef}
          width={width * DPR}
          height={height * DPR}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            pointerEvents: 'none',
            // Additive blending - effect adds to existing content
            mixBlendMode: 'screen',
            // Only show canvas when WebGL is initialized
            opacity: isInitialized ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}

export default ShaderEffectCanvas;
