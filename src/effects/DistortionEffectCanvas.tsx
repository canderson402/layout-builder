/**
 * Shader Effects System - DistortionEffectCanvas Component
 *
 * Captures content to a WebGL texture and applies distortion shaders.
 * Used for effects that transform/warp the content itself (wave, twist, etc.)
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { EffectName, ShaderUniforms } from './types';
import {
  WebGLContext,
  initWebGL,
  setUniforms,
  render,
  updateTexture,
  destroyWebGL,
  toRgba,
} from './webglUtils';

export interface DistortionEffectCanvasProps {
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
  /** Secondary effect color */
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

/**
 * Capture content containing SVG elements properly
 * html2canvas has issues with SVG viewBox, so we use foreignObject approach
 */
async function captureSvgContent(
  element: HTMLElement,
  width: number,
  height: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context');
  }

  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement;

  // Get computed styles and apply them inline
  const computedStyle = window.getComputedStyle(element);
  clone.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    position: relative;
    margin: 0;
    padding: 0;
    background-color: ${computedStyle.backgroundColor};
  `;

  // Serialize to SVG foreignObject
  const serializer = new XMLSerializer();
  const htmlString = serializer.serializeToString(clone);

  // Create SVG wrapper with foreignObject
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
      <foreignObject width="100%" height="100%" style="transform: scale(${scale}); transform-origin: top left;">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px;">
          ${htmlString}
        </div>
      </foreignObject>
    </svg>
  `;

  // Convert to data URL
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      console.error('[captureSvgContent] Failed to load SVG image, falling back to html2canvas');
      // Fallback to html2canvas if SVG approach fails
      html2canvas(element, {
        backgroundColor: null,
        scale: scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
      }).then(resolve).catch(reject);
    };
    img.src = url;
  });
}

export function DistortionEffectCanvas({
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
}: DistortionEffectCanvasProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLContext | null>(null);
  const capturedTextureRef = useRef<HTMLCanvasElement | null>(null);
  const initializingRef = useRef(false);
  const effectIdRef = useRef(0);

  const [isReady, setIsReady] = useState(false);

  // Memoize colors
  const primaryColorRgba = useMemo(() => toRgba(primaryColor), [primaryColor]);
  const secondaryColorRgba = useMemo(() => toRgba(secondaryColor), [secondaryColor]);

  // Should we show the effect?
  const shouldRenderEffect = active && effect !== 'none';

  // Initialize WebGL context when effect changes (before capture)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effect === 'none') {
      return;
    }

    // Initialize WebGL context for this effect (do this early, before any async operations)
    if (glContextRef.current) {
      destroyWebGL(glContextRef.current);
      glContextRef.current = null;
    }

    console.log('[DistortionEffectCanvas] Pre-initializing WebGL for effect:', effect);
    const ctx = initWebGL(canvas, effect);
    if (ctx) {
      glContextRef.current = ctx;
      console.log('[DistortionEffectCanvas] WebGL context created successfully');
    } else {
      console.error('[DistortionEffectCanvas] Failed to create WebGL context');
    }

    return () => {
      if (glContextRef.current) {
        destroyWebGL(glContextRef.current);
        glContextRef.current = null;
      }
    };
  }, [effect]);

  // Capture content and update texture when effect becomes active
  useEffect(() => {
    if (!shouldRenderEffect) {
      // Reset when effect ends
      setIsReady(false);
      capturedTextureRef.current = null;
      initializingRef.current = false;
      return;
    }

    const contentElement = contentRef.current;
    const canvas = canvasRef.current;
    const glContext = glContextRef.current;

    if (!contentElement || !canvas) {
      console.log('[DistortionEffectCanvas] Missing elements:', {
        contentElement: !!contentElement,
        canvas: !!canvas
      });
      return;
    }

    if (!glContext) {
      console.log('[DistortionEffectCanvas] No WebGL context available');
      return;
    }

    // Prevent multiple initializations
    if (initializingRef.current) {
      return;
    }
    initializingRef.current = true;

    // Increment effect ID to track which invocation we're in
    const currentEffectId = ++effectIdRef.current;

    // Capture content and upload texture
    const captureAndUpload = async () => {
      try {
        console.log('[DistortionEffectCanvas] Starting capture for effect:', effect);

        // Wait for fonts to be ready
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        console.log('[DistortionEffectCanvas] Capturing element, size:', width, 'x', height);

        // Simple html2canvas capture - let it determine size from element
        const capturedCanvas = await html2canvas(contentElement, {
          backgroundColor: null,
          scale: 1, // Capture at 1:1 CSS pixels
          logging: false,
          useCORS: true,
          allowTaint: true,
        });

        console.log('[DistortionEffectCanvas] Captured:', capturedCanvas.width, 'x', capturedCanvas.height);

        // Verify capture succeeded (canvas has actual content)
        if (capturedCanvas.width === 0 || capturedCanvas.height === 0) {
          console.error('[DistortionEffectCanvas] Capture resulted in empty canvas');
          initializingRef.current = false;
          return;
        }

        // Check if this effect invocation is still valid
        if (currentEffectId !== effectIdRef.current) {
          console.log('[DistortionEffectCanvas] Effect cancelled during capture');
          initializingRef.current = false;
          return;
        }

        console.log('[DistortionEffectCanvas] Capture complete, size:', capturedCanvas.width, 'x', capturedCanvas.height);
        capturedTextureRef.current = capturedCanvas;

        // Verify WebGL context is still valid
        if (!glContextRef.current) {
          console.log('[DistortionEffectCanvas] WebGL context lost during capture');
          initializingRef.current = false;
          return;
        }

        // Upload the captured texture
        updateTexture(glContextRef.current, capturedCanvas);
        console.log('[DistortionEffectCanvas] Texture uploaded');
        setIsReady(true);
      } catch (error) {
        console.error('[DistortionEffectCanvas] Failed to capture content:', error);
        initializingRef.current = false;
      }
    };

    captureAndUpload();

    return () => {
      initializingRef.current = false;
    };
  }, [shouldRenderEffect, effect, width, height]);

  // Render frame with distortion
  const renderFrame = useCallback(
    (currentProgress: number, time: number) => {
      const glContext = glContextRef.current;
      const canvas = canvasRef.current;

      if (!glContext || !canvas || !isReady) {
        return;
      }

      // Set uniforms
      const uniforms: ShaderUniforms = {
        u_time: time / 1000,
        u_progress: currentProgress,
        u_intensity: intensity,
        u_primaryColor: primaryColorRgba,
        u_secondaryColor: secondaryColorRgba,
        u_center: center,
        u_resolution: [width, height],
      };

      setUniforms(glContext, uniforms);

      // Render
      render(glContext, width, height);
    },
    [isReady, intensity, primaryColorRgba, secondaryColorRgba, center, width, height]
  );

  // Render when progress changes
  useEffect(() => {
    if (!active || effect === 'none' || !isReady) {
      return;
    }

    if (progress !== undefined) {
      renderFrame(progress, performance.now());
    }
  }, [active, effect, isReady, progress, renderFrame]);

  // Show content when not active or not ready yet
  // Hide content and show WebGL canvas when ready
  const showContent = !shouldRenderEffect || !isReady;

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
      {/* Content layer - visible until capture is complete */}
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          opacity: showContent ? 1 : 0,
          pointerEvents: showContent ? 'auto' : 'none',
        }}
      >
        {children}
      </div>

      {/* WebGL distortion canvas - always in DOM to avoid timing issues, visibility controlled by opacity */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          opacity: shouldRenderEffect && isReady ? 1 : 0,
          visibility: shouldRenderEffect && isReady ? 'visible' : 'hidden',
        }}
      />
    </div>
  );
}

export default DistortionEffectCanvas;
