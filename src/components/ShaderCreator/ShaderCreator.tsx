import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useShaderPresetsOptional, ShaderPresetParams, NoiseType } from '../../effects';
import ShaderExporter from './ShaderExporter';
import './ShaderCreator.css';

// Performance constants
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const TIME_STEP = 1 / 60; // Fixed time step

// Shader parameters interface (same as ShaderPresetParams)
interface ShaderParams {
  seed: number;
  colorShift: number;
  colorSpeed: number;
  distortionAmount: number;
  noiseScale: number;
  speed: number;
  octaves: number;
  saturation: number;
  brightness: number;
  vignette: number;
  grain: number;
  noiseType: NoiseType;
  cellSize: number;
  cellEdge: number;
  loopDuration: number; // Loop duration in seconds for seamless animation
}

// Noise type display names
const NOISE_TYPE_LABELS: Record<NoiseType, string> = {
  simplex: 'Simplex Noise',
  perlin: 'Classic Perlin',
  value: 'Value Noise',
  voronoi: 'Voronoi Cells',
  worley: 'Worley Noise',
  white: 'White Noise',
};

// Vertex shader - simple fullscreen quad
const vertexShaderSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Fragment shader with multiple noise types
// Uses looping time for seamless animation that matches export
const fragmentShaderSource = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform float seed;
  uniform float colorShift;
  uniform float colorSpeed;
  uniform float distortionAmount;
  uniform float noiseScale;
  uniform float speed;
  uniform float octaves;
  uniform float saturation;
  uniform float brightness;
  uniform float vignetteAmount;
  uniform float grainAmount;
  uniform int noiseType;      // 0=simplex, 1=perlin, 2=value, 3=voronoi, 4=worley, 5=white
  uniform float cellSize;     // For voronoi/worley
  uniform float cellEdge;     // For voronoi edge detection
  uniform float loopDuration; // Loop duration for seamless animation

  // ===== COMMON UTILITIES =====
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

  // Hash functions for various noise types
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  // ===== WHITE NOISE =====
  float whiteNoise(vec3 p) {
    return hash(dot(p, vec3(12.9898, 78.233, 45.543))) * 2.0 - 1.0;
  }

  // ===== VALUE NOISE =====
  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep interpolation

    float n000 = hash(dot(i, vec3(1.0, 57.0, 113.0)));
    float n001 = hash(dot(i + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n010 = hash(dot(i + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n011 = hash(dot(i + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n100 = hash(dot(i + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n101 = hash(dot(i + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n110 = hash(dot(i + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n111 = hash(dot(i + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));

    float nx00 = mix(n000, n100, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z) * 2.0 - 1.0;
  }

  // ===== CLASSIC PERLIN NOISE =====
  float perlinNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = fade(f);

    // Gradient vectors
    vec3 ga = hash3(i + vec3(0.0, 0.0, 0.0)) * 2.0 - 1.0;
    vec3 gb = hash3(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0;
    vec3 gc = hash3(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0;
    vec3 gd = hash3(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0;
    vec3 ge = hash3(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0;
    vec3 gf = hash3(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0;
    vec3 gg = hash3(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0;
    vec3 gh = hash3(i + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0;

    // Dot products with distance vectors
    float va = dot(ga, f - vec3(0.0, 0.0, 0.0));
    float vb = dot(gb, f - vec3(1.0, 0.0, 0.0));
    float vc = dot(gc, f - vec3(0.0, 1.0, 0.0));
    float vd = dot(gd, f - vec3(1.0, 1.0, 0.0));
    float ve = dot(ge, f - vec3(0.0, 0.0, 1.0));
    float vf = dot(gf, f - vec3(1.0, 0.0, 1.0));
    float vg = dot(gg, f - vec3(0.0, 1.0, 1.0));
    float vh = dot(gh, f - vec3(1.0, 1.0, 1.0));

    // Trilinear interpolation
    return mix(mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y),
               mix(mix(ve, vf, u.x), mix(vg, vh, u.x), u.y), u.z);
  }

  // ===== 3D SIMPLEX NOISE =====
  float simplexNoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // ===== VORONOI / CELLULAR NOISE =====
  vec2 voronoiNoise(vec3 p, float cs) {
    vec3 n = floor(p / cs);
    vec3 f = fract(p / cs);

    float md = 8.0;   // minimum distance to cell center
    float md2 = 8.0;  // second minimum distance
    vec3 mg;          // closest cell

    for(int k = -1; k <= 1; k++) {
      for(int j = -1; j <= 1; j++) {
        for(int i = -1; i <= 1; i++) {
          vec3 g = vec3(float(i), float(j), float(k));
          vec3 o = hash3(n + g);  // random offset within cell
          vec3 r = g + o - f;
          float d = dot(r, r);

          if(d < md) {
            md2 = md;
            md = d;
            mg = g;
          } else if(d < md2) {
            md2 = d;
          }
        }
      }
    }

    return vec2(sqrt(md), sqrt(md2) - sqrt(md)); // distance and edge
  }

  // ===== WORLEY NOISE (F1 distance) =====
  float worleyNoise(vec3 p, float cs) {
    vec3 n = floor(p / cs);
    vec3 f = fract(p / cs);

    float md = 8.0;

    for(int k = -1; k <= 1; k++) {
      for(int j = -1; j <= 1; j++) {
        for(int i = -1; i <= 1; i++) {
          vec3 g = vec3(float(i), float(j), float(k));
          vec3 o = hash3(n + g);
          vec3 r = g + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
    }

    return sqrt(md) * 2.0 - 1.0;
  }

  // ===== NOISE SELECTOR =====
  float getNoise(vec3 p) {
    if(noiseType == 0) return simplexNoise(p);
    if(noiseType == 1) return perlinNoise(p);
    if(noiseType == 2) return valueNoise(p);
    if(noiseType == 3) {
      vec2 v = voronoiNoise(p, cellSize);
      return mix(v.x * 2.0 - 1.0, v.y * cellEdge, 0.5);
    }
    if(noiseType == 4) return worleyNoise(p, cellSize);
    if(noiseType == 5) return whiteNoise(p);
    return simplexNoise(p);
  }

  // Fractal Brownian Motion using selected noise (max 5 octaves for performance)
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float oct = min(octaves, 5.0);

    for(float i = 0.0; i < 5.0; i++) {
      if(i >= oct) break;
      value += amplitude * getNoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // HSV to RGB conversion
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Use consistent UV space - always square coordinates
    vec2 centeredUV = (uv - 0.5) * 2.0;

    // Apply looping time - use sine/cosine for seamless wrap
    // Speed controls how fast we move through the loop
    float scaledTime = time * speed;
    float loopTime = mod(scaledTime, loopDuration);
    float loopPhase = loopTime / loopDuration * 6.28318; // 0 to 2*PI

    // Create seamlessly looping time using circular motion in noise space
    float tSin = sin(loopPhase) * 2.0;
    float tCos = cos(loopPhase) * 2.0;

    // Create liquid distortion using layered noise
    vec3 noisePos = vec3(centeredUV * noiseScale, tSin + seed);
    float noise1 = fbm(noisePos);

    // Apply distortion to coordinates
    vec2 distortion = vec2(noise1, noise1 * 0.7) * distortionAmount;
    vec2 distortedUV = centeredUV + distortion * 0.3;

    // Create flowing pattern (reduced from 3 to 1 fbm call for performance)
    vec3 colorPos = vec3(distortedUV * 1.5, tCos);
    float pattern1 = fbm(colorPos);

    // Combine for color
    float combined = pattern1 * 0.5 + 0.5;

    // Create colors with looping hue
    float hue = mod(combined + colorShift + loopPhase * colorSpeed, 6.28) / 6.28;
    vec3 hsv = vec3(hue, saturation, brightness + pattern1 * 0.15);
    vec3 color = hsv2rgb(hsv);

    // Lighting based on noise
    color *= 0.8 + pattern1 * 0.2;

    // Vignette
    float vignette = 1.0 - length(centeredUV) * vignetteAmount;
    color *= vignette;

    // Add grain
    if (grainAmount > 0.001) {
      float grainSeed = mod(scaledTime * 60.0, 1000.0);
      float grain = fract(sin(dot(uv + grainSeed * 0.001, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * grainAmount;
    }

    gl_FragColor = vec4(color, 1.0);
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

export default function ShaderCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Shader presets context (optional - may not be wrapped in provider)
  const presetsContext = useShaderPresetsOptional();

  const [isPlaying, setIsPlaying] = useState(true);
  const [presetName, setPresetName] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showExporter, setShowExporter] = useState(false);
  const [params, setParams] = useState<ShaderParams>({
    seed: Math.random() * 1000,
    colorShift: Math.random() * 6.28,
    colorSpeed: 0,  // Default to 0 for static colors
    distortionAmount: 0.5 + Math.random() * 1.5,
    noiseScale: 0.5 + Math.random() * 2.0,
    speed: 0.2 + Math.random() * 0.8,
    octaves: Math.floor(3 + Math.random() * 4),
    saturation: 0.8 + Math.random() * 0.4,
    brightness: 0.8,
    vignette: 0.3,
    grain: 0.03,
    noiseType: 'simplex',
    cellSize: 1.0,
    cellEdge: 2.0,
    loopDuration: 4.0, // 4 second loop
  });

  // Uniform locations ref
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  // Store params in a ref so render loop doesn't restart on changes
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Frame timing for throttling
  const lastFrameTimeRef = useRef(0);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl as WebGLRenderingContext;

    // Create shaders
    const vertexShader = createShader(gl as WebGLRenderingContext, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl as WebGLRenderingContext, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    // Create program
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

    // Create fullscreen quad
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      seed: gl.getUniformLocation(program, 'seed'),
      colorShift: gl.getUniformLocation(program, 'colorShift'),
      colorSpeed: gl.getUniformLocation(program, 'colorSpeed'),
      distortionAmount: gl.getUniformLocation(program, 'distortionAmount'),
      noiseScale: gl.getUniformLocation(program, 'noiseScale'),
      speed: gl.getUniformLocation(program, 'speed'),
      octaves: gl.getUniformLocation(program, 'octaves'),
      saturation: gl.getUniformLocation(program, 'saturation'),
      brightness: gl.getUniformLocation(program, 'brightness'),
      vignetteAmount: gl.getUniformLocation(program, 'vignetteAmount'),
      grainAmount: gl.getUniformLocation(program, 'grainAmount'),
      noiseType: gl.getUniformLocation(program, 'noiseType'),
      cellSize: gl.getUniformLocation(program, 'cellSize'),
      cellEdge: gl.getUniformLocation(program, 'cellEdge'),
      loopDuration: gl.getUniformLocation(program, 'loopDuration'),
    };

    // Handle resize
    const handleResize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Render loop - OPTIMIZED: uses refs to avoid restarts on param changes
  useEffect(() => {
    const render = (timestamp: number) => {
      // Frame throttling
      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < FRAME_INTERVAL) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);

      const gl = glRef.current;
      const canvas = canvasRef.current;
      const uniforms = uniformsRef.current;
      const currentParams = paramsRef.current;

      if (!gl || !canvas) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      // Always advance time when playing - speed is controlled in shader
      if (isPlaying) {
        timeRef.current += TIME_STEP;
      }

      // Convert noise type to integer for shader
      const noiseTypeIndex: Record<NoiseType, number> = {
        simplex: 0, perlin: 1, value: 2, voronoi: 3, worley: 4, white: 5
      };

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, timeRef.current);
      gl.uniform1f(uniforms.seed, currentParams.seed);
      gl.uniform1f(uniforms.colorShift, currentParams.colorShift);
      gl.uniform1f(uniforms.colorSpeed, currentParams.colorSpeed);
      gl.uniform1f(uniforms.distortionAmount, currentParams.distortionAmount);
      gl.uniform1f(uniforms.noiseScale, currentParams.noiseScale);
      gl.uniform1f(uniforms.speed, currentParams.speed);
      gl.uniform1f(uniforms.octaves, currentParams.octaves);
      gl.uniform1f(uniforms.saturation, currentParams.saturation);
      gl.uniform1f(uniforms.brightness, currentParams.brightness);
      gl.uniform1f(uniforms.vignetteAmount, currentParams.vignette);
      gl.uniform1f(uniforms.grainAmount, currentParams.grain);
      gl.uniform1i(uniforms.noiseType, noiseTypeIndex[currentParams.noiseType]);
      gl.uniform1f(uniforms.cellSize, currentParams.cellSize);
      gl.uniform1f(uniforms.cellEdge, currentParams.cellEdge);
      gl.uniform1f(uniforms.loopDuration, currentParams.loopDuration);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]); // NOTE: Only depends on isPlaying, not params (uses ref)

  // Randomize all parameters
  const randomize = useCallback(() => {
    const noiseTypes: NoiseType[] = ['simplex', 'perlin', 'value', 'voronoi', 'worley', 'white'];
    setParams(prev => ({
      seed: Math.random() * 1000,
      colorShift: Math.random() * 6.28,
      colorSpeed: 0,  // Keep colors stable by default when randomizing
      distortionAmount: 0.5 + Math.random() * 1.5,
      noiseScale: 0.5 + Math.random() * 2.0,
      speed: 0.2 + Math.random() * 0.8,
      octaves: Math.floor(3 + Math.random() * 4),
      saturation: 0.8 + Math.random() * 0.4,
      brightness: 0.6 + Math.random() * 0.4,
      vignette: 0.1 + Math.random() * 0.4,
      grain: Math.random() * 0.06,
      noiseType: noiseTypes[Math.floor(Math.random() * noiseTypes.length)],
      cellSize: 0.5 + Math.random() * 1.5,
      cellEdge: 1.0 + Math.random() * 4.0,
      loopDuration: prev.loopDuration, // Keep loop duration when randomizing
    }));
  }, []);

  // Reset to defaults
  const resetDefaults = useCallback(() => {
    setParams({
      seed: 0,
      colorShift: 0,
      colorSpeed: 0,  // Static colors by default
      distortionAmount: 1.0,
      noiseScale: 1.0,
      speed: 0.5,
      octaves: 5,
      saturation: 1.0,
      brightness: 0.8,
      vignette: 0.3,
      grain: 0.03,
      noiseType: 'simplex',
      cellSize: 1.0,
      cellEdge: 2.0,
      loopDuration: 4.0,
    });
  }, []);

  // Save current params as a preset
  const savePreset = useCallback(() => {
    if (!presetsContext) {
      setSaveMessage('Presets not available');
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }

    const name = presetName.trim() || `Preset ${new Date().toLocaleTimeString()}`;
    presetsContext.savePreset(name, params as ShaderPresetParams);
    setSaveMessage(`Saved "${name}"`);
    setPresetName('');
    setTimeout(() => setSaveMessage(null), 2000);
  }, [presetsContext, presetName, params]);

  // Load a preset (with defaults for older presets missing new params)
  const loadPreset = useCallback((presetParams: ShaderPresetParams) => {
    setParams(prev => ({
      ...presetParams,
      noiseType: presetParams.noiseType ?? 'simplex',
      cellSize: presetParams.cellSize ?? 1.0,
      cellEdge: presetParams.cellEdge ?? 2.0,
      loopDuration: (presetParams as any).loopDuration ?? prev.loopDuration,
    }));
  }, []);

  // Export all presets as JSON file
  const exportPresets = useCallback(() => {
    if (!presetsContext || presetsContext.presets.length === 0) {
      setSaveMessage('No presets to export');
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }

    const exportData = {
      version: 1,
      type: 'shader-presets',
      exportedAt: new Date().toISOString(),
      presets: presetsContext.presets,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shader-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSaveMessage('Presets exported!');
    setTimeout(() => setSaveMessage(null), 2000);
  }, [presetsContext]);

  // Import presets from JSON file
  const importPresets = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !presetsContext) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.type !== 'shader-presets' || !Array.isArray(data.presets)) {
          throw new Error('Invalid preset file');
        }

        // Import each preset
        let imported = 0;
        data.presets.forEach((preset: any) => {
          if (preset.name && preset.params) {
            presetsContext.savePreset(preset.name, preset.params);
            imported++;
          }
        });

        setSaveMessage(`Imported ${imported} presets!`);
        setTimeout(() => setSaveMessage(null), 2000);
      } catch (err) {
        setSaveMessage('Failed to import presets');
        setTimeout(() => setSaveMessage(null), 2000);
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be imported again
    event.target.value = '';
  }, [presetsContext]);

  // Update single parameter
  const updateParam = useCallback((key: keyof ShaderParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Keyboard controls - only when not typing in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'KeyR') {
        randomize();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [randomize]);

  return (
    <div className="shader-creator">
      <canvas ref={canvasRef} className="shader-canvas" />

      <div className="shader-controls">
        <h3>Liquid Shader Creator</h3>

        <div className="control-buttons">
          <button onClick={randomize} className="control-btn primary">
            Randomize
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="control-btn secondary">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={resetDefaults} className="control-btn secondary">
            Reset
          </button>
        </div>

        <button onClick={() => setShowExporter(true)} className="video-export-btn">
          Export Looping Video
        </button>

        {/* Save Preset Section */}
        <div className="control-section save-section">
          <h4>Save Preset</h4>
          <div className="save-preset-row">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="preset-name-input"
              onKeyDown={(e) => e.key === 'Enter' && savePreset()}
            />
            <button onClick={savePreset} className="control-btn primary save-btn">
              Save
            </button>
          </div>
          {saveMessage && <div className="save-message">{saveMessage}</div>}
        </div>

        {/* Saved Presets List */}
        {presetsContext && presetsContext.presets.length > 0 && (
          <div className="control-section presets-section">
            <h4>Saved Presets ({presetsContext.presets.length})</h4>
            <div className="presets-list">
              {presetsContext.presets.map((preset) => (
                <div key={preset.id} className="preset-item">
                  <button
                    className="preset-load-btn"
                    onClick={() => loadPreset(preset.params)}
                    title={`Load "${preset.name}"`}
                  >
                    {preset.name}
                  </button>
                  <button
                    className="preset-delete-btn"
                    onClick={() => presetsContext.deletePreset(preset.id)}
                    title="Delete preset"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="preset-actions">
              <button onClick={exportPresets} className="control-btn secondary export-btn">
                Export All
              </button>
              <label className="control-btn secondary import-btn">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importPresets}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        )}

        {/* Import button when no presets */}
        {presetsContext && presetsContext.presets.length === 0 && (
          <div className="control-section presets-section">
            <h4>Presets</h4>
            <p className="no-presets-text">No saved presets yet</p>
            <label className="control-btn secondary import-btn full-width">
              Import Presets
              <input
                type="file"
                accept=".json"
                onChange={importPresets}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        <div className="control-section">
          <h4>Noise Type</h4>

          <div className="control-row noise-type-row">
            <select
              value={params.noiseType}
              onChange={(e) => setParams(prev => ({ ...prev, noiseType: e.target.value as NoiseType }))}
              className="noise-type-select"
            >
              {(Object.keys(NOISE_TYPE_LABELS) as NoiseType[]).map((type) => (
                <option key={type} value={type}>{NOISE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>

          {/* Cell controls for voronoi/worley noise */}
          {(params.noiseType === 'voronoi' || params.noiseType === 'worley') && (
            <>
              <div className="control-row">
                <label>Cell Size</label>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={params.cellSize}
                  onChange={(e) => updateParam('cellSize', parseFloat(e.target.value))}
                />
                <span className="value">{params.cellSize.toFixed(1)}</span>
              </div>
              {params.noiseType === 'voronoi' && (
                <div className="control-row">
                  <label>Edge Strength</label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="0.5"
                    value={params.cellEdge}
                    onChange={(e) => updateParam('cellEdge', parseFloat(e.target.value))}
                  />
                  <span className="value">{params.cellEdge.toFixed(1)}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="control-section">
          <h4>Pattern</h4>

          <div className="control-row">
            <label>Noise Scale</label>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={params.noiseScale}
              onChange={(e) => updateParam('noiseScale', parseFloat(e.target.value))}
            />
            <span className="value">{params.noiseScale.toFixed(1)}</span>
          </div>

          <div className="control-row">
            <label>Distortion</label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={params.distortionAmount}
              onChange={(e) => updateParam('distortionAmount', parseFloat(e.target.value))}
            />
            <span className="value">{params.distortionAmount.toFixed(1)}</span>
          </div>

          <div className="control-row">
            <label>Octaves</label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={params.octaves}
              onChange={(e) => updateParam('octaves', parseInt(e.target.value))}
            />
            <span className="value">{params.octaves}</span>
          </div>

          <div className="control-row">
            <label>Speed</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={params.speed}
              onChange={(e) => updateParam('speed', parseFloat(e.target.value))}
            />
            <span className="value">{params.speed.toFixed(2)}</span>
          </div>

          <div className="control-row">
            <label>Loop Duration</label>
            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={params.loopDuration}
              onChange={(e) => updateParam('loopDuration', parseFloat(e.target.value))}
            />
            <span className="value">{params.loopDuration.toFixed(0)}s</span>
          </div>

          <div className="control-row">
            <label>Seed</label>
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={params.seed}
              onChange={(e) => updateParam('seed', parseFloat(e.target.value))}
            />
            <span className="value">{Math.round(params.seed)}</span>
          </div>
        </div>

        <div className="control-section">
          <h4>Color</h4>

          <div className="control-row">
            <label>Color Shift</label>
            <input
              type="range"
              min="0"
              max="6.28"
              step="0.1"
              value={params.colorShift}
              onChange={(e) => updateParam('colorShift', parseFloat(e.target.value))}
            />
            <span className="value">{params.colorShift.toFixed(1)}</span>
          </div>

          <div className="control-row">
            <label>Color Speed</label>
            <input
              type="range"
              min="0"
              max="0.2"
              step="0.01"
              value={params.colorSpeed}
              onChange={(e) => updateParam('colorSpeed', parseFloat(e.target.value))}
            />
            <span className="value">{params.colorSpeed.toFixed(2)}</span>
          </div>

          <div className="control-row">
            <label>Saturation</label>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={params.saturation}
              onChange={(e) => updateParam('saturation', parseFloat(e.target.value))}
            />
            <span className="value">{params.saturation.toFixed(2)}</span>
          </div>

          <div className="control-row">
            <label>Brightness</label>
            <input
              type="range"
              min="0.2"
              max="1.2"
              step="0.05"
              value={params.brightness}
              onChange={(e) => updateParam('brightness', parseFloat(e.target.value))}
            />
            <span className="value">{params.brightness.toFixed(2)}</span>
          </div>
        </div>

        <div className="control-section">
          <h4>Effects</h4>

          <div className="control-row">
            <label>Vignette</label>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={params.vignette}
              onChange={(e) => updateParam('vignette', parseFloat(e.target.value))}
            />
            <span className="value">{params.vignette.toFixed(2)}</span>
          </div>

          <div className="control-row">
            <label>Grain</label>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.005"
              value={params.grain}
              onChange={(e) => updateParam('grain', parseFloat(e.target.value))}
            />
            <span className="value">{params.grain.toFixed(3)}</span>
          </div>
        </div>

        <div className="control-info">
          <strong>Keyboard Shortcuts</strong>
          <div>R - Randomize</div>
          <div>Space - Play/Pause</div>
        </div>
      </div>

      {showExporter && (
        <ShaderExporter
          params={params as ShaderPresetParams}
          onClose={() => setShowExporter(false)}
        />
      )}
    </div>
  );
}
