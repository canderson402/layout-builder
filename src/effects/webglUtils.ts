/**
 * Shader Effects System - WebGL Utilities
 *
 * Low-level WebGL setup and management functions.
 * Handles shader compilation, program linking, and texture management.
 */

import { EffectName, ShaderUniforms } from './types';
import { vertexShader, fragmentShaders } from './shaderLibrary';

// =============================================================================
// WEBGL CONTEXT & PROGRAM MANAGEMENT
// =============================================================================

export interface WebGLContext {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  uniformLocations: Record<string, WebGLUniformLocation | null>;
  positionBuffer: WebGLBuffer;
}

/**
 * Initialize WebGL context with a specific shader effect
 */
export function initWebGL(
  canvas: HTMLCanvasElement,
  effectName: EffectName
): WebGLContext | null {
  // Log canvas info for debugging
  console.log('[initWebGL] Canvas:', {
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    isConnected: canvas.isConnected,
  });

  // Try different WebGL context types
  const contextOptions = {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    antialias: false,
  };

  let gl: WebGLRenderingContext | null = null;

  // Try WebGL 1 first (more compatible with our shaders)
  gl = canvas.getContext('webgl', contextOptions) as WebGLRenderingContext | null;

  if (!gl) {
    console.log('[initWebGL] webgl context failed, trying experimental-webgl');
    gl = canvas.getContext('experimental-webgl', contextOptions) as WebGLRenderingContext | null;
  }

  if (!gl) {
    console.error('[initWebGL] WebGL not supported. Canvas details:', {
      tagName: canvas.tagName,
      width: canvas.width,
      height: canvas.height,
      parent: canvas.parentElement?.tagName,
    });
    return null;
  }

  console.log('[initWebGL] WebGL context created successfully');

  // Compile shaders
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragmentSource = fragmentShaders[effectName] || fragmentShaders.none;
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vs || !fs) {
    return null;
  }

  // Link program
  const program = linkProgram(gl, vs, fs);
  if (!program) {
    return null;
  }

  // Clean up individual shaders (they're linked into program now)
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  // Setup position attribute (fullscreen quad)
  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    console.error('Failed to create position buffer');
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, // bottom-left
       1, -1, // bottom-right
      -1,  1, // top-left
       1,  1, // top-right
    ]),
    gl.STATIC_DRAW
  );

  const positionLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  // Create texture for content capture
  const texture = gl.createTexture();
  if (!texture) {
    console.error('Failed to create texture');
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Get uniform locations
  const uniformLocations = getUniformLocations(gl, program);

  return {
    gl,
    program,
    texture,
    uniformLocations,
    positionBuffer,
  };
}

/**
 * Compile a shader from source
 */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('Failed to create shader');
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error('Shader compile error:', info);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Link vertex and fragment shaders into a program
 */
function linkProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) {
    console.error('Failed to create program');
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error('Program link error:', info);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Get all uniform locations for the shader
 */
function getUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): Record<string, WebGLUniformLocation | null> {
  return {
    u_texture: gl.getUniformLocation(program, 'u_texture'),
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_progress: gl.getUniformLocation(program, 'u_progress'),
    u_intensity: gl.getUniformLocation(program, 'u_intensity'),
    u_primaryColor: gl.getUniformLocation(program, 'u_primaryColor'),
    u_secondaryColor: gl.getUniformLocation(program, 'u_secondaryColor'),
    u_center: gl.getUniformLocation(program, 'u_center'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
    // Liquid distortion shader uniforms
    u_seed: gl.getUniformLocation(program, 'u_seed'),
    u_colorShift: gl.getUniformLocation(program, 'u_colorShift'),
    u_distortionAmount: gl.getUniformLocation(program, 'u_distortionAmount'),
    u_noiseScale: gl.getUniformLocation(program, 'u_noiseScale'),
    u_speed: gl.getUniformLocation(program, 'u_speed'),
    u_octaves: gl.getUniformLocation(program, 'u_octaves'),
    u_saturation: gl.getUniformLocation(program, 'u_saturation'),
    u_brightness: gl.getUniformLocation(program, 'u_brightness'),
    u_vignetteAmount: gl.getUniformLocation(program, 'u_vignetteAmount'),
    u_grainAmount: gl.getUniformLocation(program, 'u_grainAmount'),
  };
}

/**
 * Update shader uniforms
 */
export function setUniforms(
  ctx: WebGLContext,
  uniforms: ShaderUniforms
): void {
  const { gl, program, uniformLocations } = ctx;

  gl.useProgram(program);

  // Texture is always at unit 0
  if (uniformLocations.u_texture !== null) {
    gl.uniform1i(uniformLocations.u_texture, 0);
  }

  if (uniformLocations.u_time !== null) {
    gl.uniform1f(uniformLocations.u_time, uniforms.u_time);
  }

  if (uniformLocations.u_progress !== null) {
    gl.uniform1f(uniformLocations.u_progress, uniforms.u_progress);
  }

  if (uniformLocations.u_intensity !== null) {
    gl.uniform1f(uniformLocations.u_intensity, uniforms.u_intensity);
  }

  if (uniformLocations.u_primaryColor !== null) {
    gl.uniform4fv(uniformLocations.u_primaryColor, uniforms.u_primaryColor);
  }

  if (uniformLocations.u_secondaryColor !== null) {
    gl.uniform4fv(uniformLocations.u_secondaryColor, uniforms.u_secondaryColor);
  }

  if (uniformLocations.u_center !== null) {
    gl.uniform2fv(uniformLocations.u_center, uniforms.u_center);
  }

  if (uniformLocations.u_resolution !== null) {
    gl.uniform2fv(uniformLocations.u_resolution, uniforms.u_resolution);
  }

  // Liquid distortion preset params
  if (uniforms.presetParams) {
    const p = uniforms.presetParams;
    if (uniformLocations.u_seed !== null) {
      gl.uniform1f(uniformLocations.u_seed, p.seed);
    }
    if (uniformLocations.u_colorShift !== null) {
      gl.uniform1f(uniformLocations.u_colorShift, p.colorShift);
    }
    if (uniformLocations.u_distortionAmount !== null) {
      gl.uniform1f(uniformLocations.u_distortionAmount, p.distortionAmount);
    }
    if (uniformLocations.u_noiseScale !== null) {
      gl.uniform1f(uniformLocations.u_noiseScale, p.noiseScale);
    }
    if (uniformLocations.u_speed !== null) {
      gl.uniform1f(uniformLocations.u_speed, p.speed);
    }
    if (uniformLocations.u_octaves !== null) {
      gl.uniform1f(uniformLocations.u_octaves, p.octaves);
    }
    if (uniformLocations.u_saturation !== null) {
      gl.uniform1f(uniformLocations.u_saturation, p.saturation);
    }
    if (uniformLocations.u_brightness !== null) {
      gl.uniform1f(uniformLocations.u_brightness, p.brightness);
    }
    if (uniformLocations.u_vignetteAmount !== null) {
      gl.uniform1f(uniformLocations.u_vignetteAmount, p.vignette);
    }
    if (uniformLocations.u_grainAmount !== null) {
      gl.uniform1f(uniformLocations.u_grainAmount, p.grain);
    }
  }
}

/**
 * Update texture with new image data
 */
export function updateTexture(
  ctx: WebGLContext,
  source: HTMLCanvasElement | HTMLImageElement | ImageData
): void {
  const { gl, texture } = ctx;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

/**
 * Render the effect
 */
export function render(ctx: WebGLContext, width: number, height: number): void {
  const { gl, program, texture } = ctx;

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * Clean up WebGL resources
 */
export function destroyWebGL(ctx: WebGLContext): void {
  const { gl, program, texture, positionBuffer } = ctx;

  gl.deleteTexture(texture);
  gl.deleteBuffer(positionBuffer);
  gl.deleteProgram(program);
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Convert hex color string to RGBA tuple (0-1 range)
 */
export function hexToRgba(hex: string): [number, number, number, number] {
  // Handle rgba() format
  if (hex.startsWith('rgba')) {
    const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (match) {
      return [
        parseInt(match[1], 10) / 255,
        parseInt(match[2], 10) / 255,
        parseInt(match[3], 10) / 255,
        match[4] !== undefined ? parseFloat(match[4]) : 1.0,
      ];
    }
  }

  // Handle rgb() format
  if (hex.startsWith('rgb')) {
    const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [
        parseInt(match[1], 10) / 255,
        parseInt(match[2], 10) / 255,
        parseInt(match[3], 10) / 255,
        1.0,
      ];
    }
  }

  // Handle hex format
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      result[4] !== undefined ? parseInt(result[4], 16) / 255 : 1.0,
    ];
  }

  // Handle short hex format
  const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (shortResult) {
    return [
      parseInt(shortResult[1] + shortResult[1], 16) / 255,
      parseInt(shortResult[2] + shortResult[2], 16) / 255,
      parseInt(shortResult[3] + shortResult[3], 16) / 255,
      1.0,
    ];
  }

  // Default to white
  return [1, 1, 1, 1];
}

/**
 * Convert color value (string or RGBA) to RGBA tuple
 */
export function toRgba(
  color: string | [number, number, number, number] | undefined,
  fallback: [number, number, number, number] = [1, 1, 1, 1]
): [number, number, number, number] {
  if (!color) return fallback;

  if (Array.isArray(color)) {
    return color;
  }

  return hexToRgba(color);
}

// =============================================================================
// DOM TO CANVAS CAPTURE
// =============================================================================

/**
 * Capture a DOM element to a canvas
 * Uses a simpler approach than html2canvas for performance
 */
export async function captureElement(
  element: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context');
  }

  // Try to use the foreignObject approach for capturing
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${element.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;

  const img = new Image();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: just return empty canvas
      resolve(canvas);
    };

    img.src = url;
  });
}

/**
 * Simple canvas capture using drawImage
 * For elements that are already rendered
 */
export function captureCanvas(
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  return canvas;
}
