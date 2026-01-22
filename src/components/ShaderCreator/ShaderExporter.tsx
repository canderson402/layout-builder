/**
 * Shader Video Exporter
 *
 * Exports shader animations as perfectly looping video files (MP4 or WebM).
 * Uses the same shader as the preview for consistent output.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ShaderPresetParams, NoiseType } from '../../effects';

interface ShaderExporterProps {
  params: ShaderPresetParams;
  onClose: () => void;
}

interface ExportSettings {
  duration: number;      // Loop duration in seconds
  fps: number;           // Frames per second
  width: number;         // Output width
  height: number;        // Output height
  format: 'mp4' | 'webm'; // Output format
}

// Use the SAME shader as ShaderCreator.tsx for consistent output
// Added loopDuration uniform for seamless looping
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
  uniform float loopDuration; // Loop duration for seamless wrapping

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

  // Fractal Brownian Motion using selected noise (max 5 octaves)
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

    // Create flowing pattern
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

const vertexShaderSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function ShaderExporter({ params, onClose }: ShaderExporterProps) {
  const [settings, setSettings] = useState<ExportSettings>({
    duration: 4,
    fps: 30,
    width: 512,
    height: 512,
    format: 'mp4',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load ffmpeg on mount
  useEffect(() => {
    const loadFfmpeg = async () => {
      if (ffmpegRef.current || ffmpegLoading) return;

      setFfmpegLoading(true);
      try {
        const ffmpeg = new FFmpeg();

        // Load ffmpeg core from CDN
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegRef.current = ffmpeg;
        setFfmpegLoaded(true);
      } catch (err) {
        console.error('Failed to load ffmpeg:', err);
        // Don't set error - we can still use WebM fallback
      }
      setFfmpegLoading(false);
    };

    loadFfmpeg();
  }, []);

  const exportVideo = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);
    setStatusMessage('Initializing...');

    const canvas = document.createElement('canvas');
    canvas.width = settings.width;
    canvas.height = settings.height;

    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      setError('WebGL not supported');
      setIsExporting(false);
      return;
    }

    // Setup shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      setError('Failed to compile shaders');
      setIsExporting(false);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setError('Failed to link program');
      setIsExporting(false);
      return;
    }

    gl.useProgram(program);

    // Setup geometry
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const uniforms = {
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

    const noiseTypeIndex: Record<NoiseType, number> = {
      simplex: 0, perlin: 1, value: 2, voronoi: 3, worley: 4, white: 5
    };

    // Set static uniforms
    gl.uniform2f(uniforms.resolution, settings.width, settings.height);
    gl.uniform1f(uniforms.seed, params.seed);
    gl.uniform1f(uniforms.colorShift, params.colorShift);
    gl.uniform1f(uniforms.colorSpeed, params.colorSpeed ?? 0);
    gl.uniform1f(uniforms.distortionAmount, params.distortionAmount);
    gl.uniform1f(uniforms.noiseScale, params.noiseScale);
    gl.uniform1f(uniforms.speed, 1.0); // Always use speed=1 for export to get exact loop
    gl.uniform1f(uniforms.octaves, Math.min(params.octaves, 5)); // Cap at 5 for consistency
    gl.uniform1f(uniforms.saturation, params.saturation);
    gl.uniform1f(uniforms.brightness, params.brightness);
    gl.uniform1f(uniforms.vignetteAmount, params.vignette);
    gl.uniform1f(uniforms.grainAmount, params.grain);
    gl.uniform1i(uniforms.noiseType, noiseTypeIndex[params.noiseType ?? 'simplex']);
    gl.uniform1f(uniforms.cellSize, params.cellSize ?? 1);
    gl.uniform1f(uniforms.cellEdge, params.cellEdge ?? 2);
    gl.uniform1f(uniforms.loopDuration, settings.duration);

    gl.viewport(0, 0, settings.width, settings.height);

    const totalFrames = settings.duration * settings.fps;
    const frameInterval = 1 / settings.fps;

    try {
      if (settings.format === 'mp4' && ffmpegRef.current) {
        // MP4 export using ffmpeg
        setStatusMessage('Rendering frames...');
        const ffmpeg = ffmpegRef.current;

        // Render all frames and save as PNG
        for (let frame = 0; frame < totalFrames; frame++) {
          const time = frame * frameInterval;

          gl.uniform1f(uniforms.time, time);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          // Get frame as PNG blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), 'image/png');
          });

          // Write frame to ffmpeg virtual filesystem
          const frameData = await blob.arrayBuffer();
          const paddedNum = String(frame).padStart(5, '0');
          await ffmpeg.writeFile(`frame${paddedNum}.png`, new Uint8Array(frameData));

          setProgress(Math.round((frame / totalFrames) * 50)); // 0-50% for rendering

          // Yield to UI every 10 frames
          if (frame % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        // Encode to MP4
        setStatusMessage('Encoding MP4...');
        setProgress(50);

        await ffmpeg.exec([
          '-framerate', String(settings.fps),
          '-i', 'frame%05d.png',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18', // High quality
          '-pix_fmt', 'yuv420p', // Compatibility
          '-movflags', '+faststart', // Web optimization
          'output.mp4'
        ]);

        setProgress(90);
        setStatusMessage('Preparing download...');

        // Read output file
        const data = await ffmpeg.readFile('output.mp4');
        const videoBlob = new Blob([data], { type: 'video/mp4' });

        // Cleanup virtual filesystem
        for (let i = 0; i < totalFrames; i++) {
          const paddedNum = String(i).padStart(5, '0');
          try {
            await ffmpeg.deleteFile(`frame${paddedNum}.png`);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        try {
          await ffmpeg.deleteFile('output.mp4');
        } catch (e) {
          // Ignore cleanup errors
        }

        // Download
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shader-loop-${settings.duration}s-${settings.width}x${settings.height}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

      } else {
        // WebM export using MediaRecorder (fallback or if selected)
        setStatusMessage('Rendering frames...');
        const frames: Blob[] = [];

        // Capture all frames first
        for (let frame = 0; frame < totalFrames; frame++) {
          const time = frame * frameInterval;

          gl.uniform1f(uniforms.time, time);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          // Capture frame as PNG for better quality
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), 'image/png');
          });
          frames.push(blob);

          setProgress(Math.round((frame / totalFrames) * 50));

          // Yield to UI every 10 frames
          if (frame % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        // Encode using MediaRecorder with precise frame timing
        setStatusMessage('Encoding video...');
        setProgress(50);

        const videoCanvas = document.createElement('canvas');
        videoCanvas.width = settings.width;
        videoCanvas.height = settings.height;
        const ctx = videoCanvas.getContext('2d')!;

        // Use a higher bitrate for better quality
        const stream = videoCanvas.captureStream(0); // 0 = manual frame capture
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 8000000, // 8 Mbps for better quality
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        const recordingComplete = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: 'video/webm' }));
          };
        });

        recorder.start();

        // Draw each frame with precise timing using requestAnimationFrame
        const frameTime = 1000 / settings.fps;
        let frameIndex = 0;

        const drawNextFrame = async () => {
          if (frameIndex >= frames.length) {
            recorder.stop();
            return;
          }

          const img = await createImageBitmap(frames[frameIndex]);
          ctx.drawImage(img, 0, 0);

          // Request a frame from the stream
          const track = stream.getVideoTracks()[0] as any;
          if (track.requestFrame) {
            track.requestFrame();
          }

          frameIndex++;
          setProgress(50 + Math.round((frameIndex / frames.length) * 45));

          // Use precise timing
          await new Promise(resolve => setTimeout(resolve, frameTime));
          await drawNextFrame();
        };

        await drawNextFrame();

        const videoBlob = await recordingComplete;

        // Download
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shader-loop-${settings.duration}s-${settings.width}x${settings.height}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setProgress(100);
      setStatusMessage('Export complete!');

    } catch (err) {
      setError(`Export failed: ${err}`);
    }

    setIsExporting(false);
  }, [params, settings, ffmpegLoaded]);

  const formatOptions = [
    { value: 'mp4', label: 'MP4 (H.264)', disabled: !ffmpegLoaded && !ffmpegLoading },
    { value: 'webm', label: 'WebM (VP9)', disabled: false },
  ];

  return (
    <div className="shader-exporter-overlay">
      <div className="shader-exporter-modal">
        <div className="shader-exporter-header">
          <h3>Export Looping Video</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="shader-exporter-content">
          <p className="export-description">
            Export the shader as a perfectly looping video file.
            This pre-baked video can be played on Apple TV without GPU-intensive real-time rendering.
          </p>

          <div className="export-settings">
            <div className="setting-row">
              <label>Loop Duration</label>
              <select
                value={settings.duration}
                onChange={(e) => setSettings(s => ({ ...s, duration: Number(e.target.value) }))}
                disabled={isExporting}
              >
                <option value={2}>2 seconds</option>
                <option value={4}>4 seconds</option>
                <option value={6}>6 seconds</option>
                <option value={8}>8 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>

            <div className="setting-row">
              <label>Resolution</label>
              <select
                value={`${settings.width}x${settings.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setSettings(s => ({ ...s, width: w, height: h }));
                }}
                disabled={isExporting}
              >
                <option value="256x256">256×256 (Small)</option>
                <option value="512x512">512×512 (Medium)</option>
                <option value="1024x1024">1024×1024 (Large)</option>
                <option value="1920x1080">1920×1080 (Full HD)</option>
                <option value="3840x2160">3840×2160 (4K)</option>
              </select>
            </div>

            <div className="setting-row">
              <label>Frame Rate</label>
              <select
                value={settings.fps}
                onChange={(e) => setSettings(s => ({ ...s, fps: Number(e.target.value) }))}
                disabled={isExporting}
              >
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>

            <div className="setting-row">
              <label>Format</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings(s => ({ ...s, format: e.target.value as 'mp4' | 'webm' }))}
                disabled={isExporting}
              >
                {formatOptions.map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label} {opt.disabled ? '(loading...)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="export-info">
            <strong>Estimated frames:</strong> {settings.fps * settings.duration}
            <br />
            <strong>Resolution:</strong> {settings.width}×{settings.height}
            {ffmpegLoading && (
              <>
                <br />
                <em>Loading MP4 encoder...</em>
              </>
            )}
          </div>

          {isExporting && (
            <div className="export-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span>{progress}% - {statusMessage}</span>
            </div>
          )}

          {error && (
            <div className="export-error">
              {error}
            </div>
          )}
        </div>

        <div className="shader-exporter-footer">
          <button onClick={onClose} disabled={isExporting} className="cancel-btn">
            Cancel
          </button>
          <button onClick={exportVideo} disabled={isExporting} className="export-btn">
            {isExporting ? 'Exporting...' : 'Export Video'}
          </button>
        </div>
      </div>
    </div>
  );
}
