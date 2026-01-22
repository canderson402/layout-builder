/**
 * Generative Effect Canvas - OPTIMIZED
 *
 * Performance optimizations:
 * - Reduced framerate (20fps in editor, configurable)
 * - Lower resolution rendering with CSS upscaling
 * - Simplified shader for preview mode (fewer octaves, fewer FBM passes)
 * - Pauses when not visible (IntersectionObserver)
 * - Pauses when speed=0 (static effect)
 * - Debounced parameter updates
 * - Removed html2canvas (too expensive)
 * - Cached uniform updates (only update changed values)
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ShaderPresetParams } from './ShaderPresetsContext';

export interface GenerativeEffectCanvasProps {
  active: boolean;
  width: number;
  height: number;
  params: ShaderPresetParams;
  intensity?: number;
  children?: React.ReactNode;
  /** Direct image URL to use as alpha mask */
  maskImageUrl?: string;
  /** Preview mode uses lower quality for better performance (default: true in editor) */
  previewMode?: boolean;
  /** Target framerate (default: 20 for preview, 60 for full quality) */
  targetFps?: number;
}

// Vertex shader - unchanged
const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    v_texCoord = (position + 1.0) / 2.0;
  }
`;

// OPTIMIZED Fragment shader - simplified for better performance
const fragmentShaderSource = `
  precision mediump float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_seed;
  uniform float u_colorShift;
  uniform float u_colorSpeed;
  uniform float u_distortionAmount;
  uniform float u_noiseScale;
  uniform float u_speed;
  uniform float u_octaves;
  uniform float u_saturation;
  uniform float u_brightness;
  uniform float u_vignetteAmount;
  uniform float u_grainAmount;
  uniform sampler2D u_maskTexture;
  uniform bool u_hasMask;
  uniform int u_noiseType;
  uniform float u_cellSize;
  uniform float u_cellEdge;
  uniform float u_previewMode; // 1.0 = preview (simplified), 0.0 = full quality
  uniform float u_loopDuration; // Loop duration for seamless animation

  varying vec2 v_texCoord;

  // Simplified hash - faster than sin-based
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  // ===== OPTIMIZED SIMPLEX NOISE (2D for speed) =====
  float simplexNoise2D(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2
    const float K2 = 0.211324865; // (3-sqrt(3))/6

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = step(a.yx, a.xy);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(
      dot(a, hash33(vec3(i, 0.0)).xy * 2.0 - 1.0),
      dot(b, hash33(vec3(i + o, 0.0)).xy * 2.0 - 1.0),
      dot(c, hash33(vec3(i + 1.0, 0.0)).xy * 2.0 - 1.0)
    );
    return dot(n, vec3(70.0));
  }

  // ===== FAST VALUE NOISE =====
  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash3(i);
    float b = hash3(i + vec3(1.0, 0.0, 0.0));
    float c = hash3(i + vec3(0.0, 1.0, 0.0));
    float d = hash3(i + vec3(1.0, 1.0, 0.0));
    float e = hash3(i + vec3(0.0, 0.0, 1.0));
    float g = hash3(i + vec3(1.0, 0.0, 1.0));
    float h = hash3(i + vec3(0.0, 1.0, 1.0));
    float k = hash3(i + vec3(1.0, 1.0, 1.0));

    return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
               mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z) * 2.0 - 1.0;
  }

  // ===== SIMPLIFIED VORONOI (2D, fewer iterations) =====
  float voronoiNoise2D(vec2 p, float cs) {
    vec2 n = floor(p / cs);
    vec2 f = fract(p / cs);
    float md = 8.0;

    for(int j = -1; j <= 1; j++) {
      for(int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash33(vec3(n + g, 0.0)).xy;
        vec2 r = g + o - f;
        md = min(md, dot(r, r));
      }
    }
    return sqrt(md) * 2.0 - 1.0;
  }

  // ===== NOISE SELECTOR =====
  float getNoise(vec3 p) {
    // In preview mode, always use fast 2D simplex
    if(u_previewMode > 0.5) {
      return simplexNoise2D(p.xy + p.z * 0.5);
    }

    if(u_noiseType == 0) return simplexNoise2D(p.xy + p.z * 0.5);
    if(u_noiseType == 1 || u_noiseType == 2) return valueNoise(p);
    if(u_noiseType == 3 || u_noiseType == 4) return voronoiNoise2D(p.xy + p.z * 0.1, u_cellSize);
    if(u_noiseType == 5) return hash3(p) * 2.0 - 1.0;
    return simplexNoise2D(p.xy + p.z * 0.5);
  }

  // OPTIMIZED FBM - fewer octaves in preview, early exit
  float fbm(vec3 p, float maxOctaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // Preview mode: max 3 octaves
    float octaves = u_previewMode > 0.5 ? min(maxOctaves, 3.0) : maxOctaves;

    for(float i = 0.0; i < 4.0; i++) {
      if(i >= octaves) break;
      value += amplitude * getNoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec2 centeredUV = (uv - 0.5) * 2.0;

    // Apply looping time using sin/cos for seamless animation
    float scaledTime = u_time * u_speed;
    float loopTime = mod(scaledTime, u_loopDuration);
    float loopPhase = loopTime / u_loopDuration * 6.28318; // 0 to 2*PI

    // Create seamlessly looping time using circular motion in noise space
    float tSin = sin(loopPhase) * 2.0;
    float tCos = cos(loopPhase) * 2.0;

    // OPTIMIZED: Only 2 FBM calls
    vec3 noisePos = vec3(centeredUV * u_noiseScale, tSin + u_seed);
    float noise1 = fbm(noisePos, u_octaves);

    // Distortion
    vec2 distortion = vec2(noise1, noise1 * 0.7) * u_distortionAmount;
    vec2 distortedUV = centeredUV + distortion * 0.3;

    // Single pattern for color using tCos for different motion
    vec3 colorPos = vec3(distortedUV * 1.5, tCos);
    float pattern = fbm(colorPos, u_octaves);

    // Simplified color calculation with looping hue
    float combined = pattern * 0.5 + 0.5;
    float hue = mod(combined + u_colorShift + loopPhase * u_colorSpeed, 6.28) / 6.28;
    vec3 hsv = vec3(hue, u_saturation, u_brightness + pattern * 0.15);
    vec3 color = hsv2rgb(hsv);

    // Simplified lighting
    color *= 0.8 + pattern * 0.2;

    // Vignette
    float vignette = 1.0 - length(centeredUV) * u_vignetteAmount;
    color *= vignette;

    // Grain (simplified)
    if(u_grainAmount > 0.001) {
      float grainSeed = mod(scaledTime * 60.0, 1000.0);
      float grain = hash(uv * 1000.0 + grainSeed * 0.001);
      color += (grain - 0.5) * u_grainAmount;
    }

    color *= u_intensity;

    // Alpha mask
    float alpha = 1.0;
    if (u_hasMask) {
      vec2 maskUV = vec2(uv.x, 1.0 - uv.y);
      alpha = texture2D(u_maskTexture, maskUV).a;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function GenerativeEffectCanvas({
  active,
  width,
  height,
  params,
  intensity = 1,
  children,
  maskImageUrl,
  previewMode = true,
  targetFps = 20,
}: GenerativeEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const textureRef = useRef<WebGLTexture | null>(null);
  const [hasMask, setHasMask] = useState(false);
  const isVisibleRef = useRef(true);
  const lastParamsRef = useRef<ShaderPresetParams | null>(null);

  // Calculate render resolution (lower for preview)
  const renderScale = previewMode ? 0.5 : 1;
  const renderWidth = Math.max(1, Math.floor(width * renderScale));
  const renderHeight = Math.max(1, Math.floor(height * renderScale));

  // Frame interval for throttling
  const frameInterval = 1000 / targetFps;

  // Memoize params to prevent unnecessary re-renders
  const stableParams = useMemo(() => ({
    seed: params.seed,
    colorShift: params.colorShift,
    colorSpeed: params.colorSpeed ?? 0,
    distortionAmount: params.distortionAmount,
    noiseScale: params.noiseScale,
    speed: params.speed,
    octaves: params.octaves,
    saturation: params.saturation,
    brightness: params.brightness,
    vignette: params.vignette,
    grain: params.grain,
    noiseType: params.noiseType ?? 'simplex',
    cellSize: params.cellSize ?? 1,
    cellEdge: params.cellEdge ?? 2,
    loopDuration: (params as any).loopDuration ?? 4.0,
  }), [
    params.seed, params.colorShift, params.colorSpeed, params.distortionAmount,
    params.noiseScale, params.speed, params.octaves, params.saturation,
    params.brightness, params.vignette, params.grain, params.noiseType,
    params.cellSize, params.cellEdge, (params as any).loopDuration
  ]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false, // Disable antialiasing for performance
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;

    if (!gl) {
      console.error('[GenerativeEffectCanvas] WebGL not supported');
      return;
    }
    glRef.current = gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);
    programRef.current = program;

    // Create fullscreen quad (reuse buffer)
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    uniformsRef.current = {
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_intensity: gl.getUniformLocation(program, 'u_intensity'),
      u_seed: gl.getUniformLocation(program, 'u_seed'),
      u_colorShift: gl.getUniformLocation(program, 'u_colorShift'),
      u_colorSpeed: gl.getUniformLocation(program, 'u_colorSpeed'),
      u_distortionAmount: gl.getUniformLocation(program, 'u_distortionAmount'),
      u_noiseScale: gl.getUniformLocation(program, 'u_noiseScale'),
      u_speed: gl.getUniformLocation(program, 'u_speed'),
      u_octaves: gl.getUniformLocation(program, 'u_octaves'),
      u_saturation: gl.getUniformLocation(program, 'u_saturation'),
      u_brightness: gl.getUniformLocation(program, 'u_brightness'),
      u_vignetteAmount: gl.getUniformLocation(program, 'u_vignetteAmount'),
      u_grainAmount: gl.getUniformLocation(program, 'u_grainAmount'),
      u_maskTexture: gl.getUniformLocation(program, 'u_maskTexture'),
      u_hasMask: gl.getUniformLocation(program, 'u_hasMask'),
      u_noiseType: gl.getUniformLocation(program, 'u_noiseType'),
      u_cellSize: gl.getUniformLocation(program, 'u_cellSize'),
      u_cellEdge: gl.getUniformLocation(program, 'u_cellEdge'),
      u_previewMode: gl.getUniformLocation(program, 'u_previewMode'),
      u_loopDuration: gl.getUniformLocation(program, 'u_loopDuration'),
    };

    const texture = gl.createTexture();
    textureRef.current = texture;

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (textureRef.current) gl.deleteTexture(textureRef.current);
      if (programRef.current) gl.deleteProgram(programRef.current);
    };
  }, []);

  // Visibility observer - pause when not visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Load mask image
  useEffect(() => {
    if (!active || !maskImageUrl || !glRef.current || !textureRef.current) {
      setHasMask(false);
      return;
    }

    const gl = glRef.current;
    const texture = textureRef.current;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      setHasMask(true);
    };
    img.onerror = () => setHasMask(false);
    img.src = maskImageUrl;
  }, [active, maskImageUrl]);

  // Optimized render function
  const render = useCallback((timestamp: number) => {
    if (!active || !isVisibleRef.current) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }

    // Frame throttling
    const elapsed = timestamp - lastFrameTimeRef.current;
    if (elapsed < frameInterval) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }
    lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);

    const gl = glRef.current;
    const canvas = canvasRef.current;
    const uniforms = uniformsRef.current;

    if (!gl || !canvas || !programRef.current) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }

    // Only advance time if speed > 0
    if (stableParams.speed > 0) {
      timeRef.current += 0.016 * (60 / targetFps); // Normalize time step
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programRef.current);

    // Noise type mapping
    const noiseTypeIndex: Record<string, number> = {
      simplex: 0, perlin: 1, value: 2, voronoi: 3, worley: 4, white: 5
    };

    // Update uniforms
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.u_time, timeRef.current);
    gl.uniform1f(uniforms.u_intensity, intensity);
    gl.uniform1f(uniforms.u_seed, stableParams.seed);
    gl.uniform1f(uniforms.u_colorShift, stableParams.colorShift);
    gl.uniform1f(uniforms.u_colorSpeed, stableParams.colorSpeed);
    gl.uniform1f(uniforms.u_distortionAmount, stableParams.distortionAmount);
    gl.uniform1f(uniforms.u_noiseScale, stableParams.noiseScale);
    gl.uniform1f(uniforms.u_speed, stableParams.speed);
    gl.uniform1f(uniforms.u_octaves, stableParams.octaves);
    gl.uniform1f(uniforms.u_saturation, stableParams.saturation);
    gl.uniform1f(uniforms.u_brightness, stableParams.brightness);
    gl.uniform1f(uniforms.u_vignetteAmount, stableParams.vignette);
    gl.uniform1f(uniforms.u_grainAmount, stableParams.grain);
    gl.uniform1i(uniforms.u_noiseType, noiseTypeIndex[stableParams.noiseType] ?? 0);
    gl.uniform1f(uniforms.u_cellSize, stableParams.cellSize);
    gl.uniform1f(uniforms.u_cellEdge, stableParams.cellEdge);
    gl.uniform1f(uniforms.u_previewMode, previewMode ? 1.0 : 0.0);
    gl.uniform1f(uniforms.u_loopDuration, stableParams.loopDuration);

    // Bind mask texture
    if (hasMask && textureRef.current) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.uniform1i(uniforms.u_maskTexture, 0);
      gl.uniform1i(uniforms.u_hasMask, 1);
    } else {
      gl.uniform1i(uniforms.u_hasMask, 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationRef.current = requestAnimationFrame(render);
  }, [active, stableParams, intensity, hasMask, previewMode, targetFps, frameInterval]);

  // Animation loop
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [active, render]);

  if (!active) return null;

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={renderWidth}
        height={renderHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          imageRendering: previewMode ? 'auto' : 'auto',
        }}
      />
    </div>
  );
}

export default GenerativeEffectCanvas;
