/**
 * Shader Effects System - GLSL Shader Library
 *
 * Contains all WebGL/GLSL shader code for visual effects.
 * Each shader is a fragment shader that operates on a captured texture.
 */

import { EffectName, EffectDefinition } from './types';

// =============================================================================
// VERTEX SHADER (shared by all effects)
// =============================================================================

export const vertexShader = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // Convert from clip space (-1 to 1) to texture coords (0 to 1)
    v_texCoord = (a_position + 1.0) / 2.0;
    // Flip Y for WebGL coordinate system
    v_texCoord.y = 1.0 - v_texCoord.y;
  }
`;

// =============================================================================
// FRAGMENT SHADERS
// =============================================================================

/**
 * Score Burst Effect (Overlay Version)
 * Radial burst with expanding rings
 * Great for scoring events - renders as overlay on content
 */
export const scoreBurstShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_center;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    // Distance from center
    vec2 toCenter = v_texCoord - u_center;
    float dist = length(toCenter);

    // Multiple expanding rings
    float ringRadius1 = u_progress * 1.5;
    float ringRadius2 = u_progress * 1.0;
    float ringRadius3 = u_progress * 0.6;
    float ringWidth = 0.12 + u_progress * 0.05;

    float ring1 = smoothstep(ringRadius1 - ringWidth, ringRadius1, dist)
                - smoothstep(ringRadius1, ringRadius1 + ringWidth * 0.3, dist);
    float ring2 = smoothstep(ringRadius2 - ringWidth * 0.7, ringRadius2, dist)
                - smoothstep(ringRadius2, ringRadius2 + ringWidth * 0.25, dist);
    float ring3 = smoothstep(ringRadius3 - ringWidth * 0.5, ringRadius3, dist)
                - smoothstep(ringRadius3, ringRadius3 + ringWidth * 0.2, dist);

    // Combine rings with decreasing intensity
    float rings = ring1 + ring2 * 0.7 + ring3 * 0.4;

    // Pulsing intensity
    float pulse = 1.0 + sin(u_time * 20.0) * 0.2 * (1.0 - u_progress);

    // Center flash at start
    float centerFlash = (1.0 - smoothstep(0.0, 0.3, dist)) * (1.0 - u_progress) * 2.0;

    // Combine effects
    float totalEffect = (rings + centerFlash) * u_intensity * pulse;

    // Fade out over time
    float fadeOut = 1.0 - pow(u_progress, 0.7);

    // Output with alpha for blending
    gl_FragColor = u_primaryColor * totalEffect * fadeOut;
  }
`;

/**
 * Pulse Glow Effect (Overlay Version)
 * Pulsing border glow around the component
 * Good for highlighting important elements
 */
export const pulseGlowShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    // Create a border glow effect
    vec2 uv = v_texCoord;

    // Distance from edges
    float distFromLeft = uv.x;
    float distFromRight = 1.0 - uv.x;
    float distFromTop = uv.y;
    float distFromBottom = 1.0 - uv.y;

    float minDistX = min(distFromLeft, distFromRight);
    float minDistY = min(distFromTop, distFromBottom);
    float distFromEdge = min(minDistX, minDistY);

    // Pulsing animation
    float pulse = sin(u_time * 8.0) * 0.5 + 0.5;
    pulse = pow(pulse, 1.2);

    // Glow width pulses
    float glowWidth = 0.08 + pulse * 0.04;

    // Create soft edge glow
    float glow = smoothstep(glowWidth, 0.0, distFromEdge);

    // Also add corner emphasis
    float cornerDist = length(vec2(minDistX, minDistY));
    float cornerGlow = smoothstep(glowWidth * 1.5, 0.0, cornerDist) * 0.5;

    glow = max(glow, cornerGlow);

    // Fade based on progress
    float fade = sin(u_progress * 3.14159);

    // Output
    gl_FragColor = u_primaryColor * glow * u_intensity * fade;
  }
`;

/**
 * Glitch Effect (Overlay Version)
 * Scanlines, noise bars, and color distortion overlay
 * Great for dramatic moments
 */
export const glitchShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = v_texCoord;

    // Effect intensity peaks in middle of animation
    float effectStrength = sin(u_progress * 3.14159) * u_intensity;

    // Horizontal glitch bars
    float barSize = 0.02 + random(vec2(floor(u_time * 15.0), 0.0)) * 0.08;
    float barY = floor(uv.y / barSize);
    float barNoise = random(vec2(barY, floor(u_time * 12.0)));

    float glitchBar = 0.0;
    if (barNoise > 0.85) {
      glitchBar = (barNoise - 0.85) * 6.0 * effectStrength;
    }

    // Scanlines
    float scanline = sin(uv.y * u_resolution.y * 0.8 + u_time * 40.0);
    float scanlineEffect = step(0.95, abs(scanline)) * effectStrength * 0.4;

    // Color shift - RGB offset bars
    vec3 glitchColor = vec3(0.0);
    float colorShift = random(vec2(barY + 100.0, floor(u_time * 10.0)));
    if (colorShift > 0.7) {
      // Red or cyan tint
      glitchColor = colorShift > 0.85 ? vec3(1.0, 0.0, 0.3) : vec3(0.0, 1.0, 1.0);
      glitchColor *= (colorShift - 0.7) * 3.0;
    }

    // Random noise sparkles
    float noise = random(vec2(uv * u_resolution + u_time * 100.0));
    float sparkle = step(0.997, noise) * effectStrength;

    // Combine effects
    float totalEffect = glitchBar + scanlineEffect + sparkle;
    vec4 color = u_primaryColor * totalEffect;
    color.rgb += glitchColor * glitchBar;

    gl_FragColor = color;
  }
`;

/**
 * Ripple Effect (Overlay Version)
 * Concentric wave rings emanating from center
 * Good for impact moments
 */
export const rippleShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_center;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;
    vec2 toCenter = uv - u_center;

    // Aspect ratio correction
    float aspect = u_resolution.x / u_resolution.y;
    toCenter.x *= aspect;

    float dist = length(toCenter);

    // Multiple expanding wave rings
    float totalWave = 0.0;

    for (float i = 0.0; i < 4.0; i++) {
      float delay = i * 0.15;
      float waveProgress = u_progress - delay;

      if (waveProgress > 0.0 && waveProgress < 1.0) {
        float radius = waveProgress * 1.2;
        float ringWidth = 0.03 + waveProgress * 0.02;

        // Create ring
        float ring = smoothstep(radius - ringWidth, radius, dist)
                   - smoothstep(radius, radius + ringWidth * 0.5, dist);

        // Fade out as it expands
        float fade = 1.0 - waveProgress;
        totalWave += ring * fade;
      }
    }

    // Add subtle shimmer
    float shimmer = sin(dist * 30.0 - u_time * 10.0) * 0.1 + 0.9;

    // Output
    gl_FragColor = u_primaryColor * totalWave * u_intensity * shimmer;
  }
`;

/**
 * Confetti Effect (Overlay Version)
 * Falling colorful particles overlay
 * Perfect for celebrations
 */
export const confettiShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec4 u_secondaryColor;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Grid for confetti positions
    float gridSize = 20.0;
    vec2 grid = floor(v_texCoord * gridSize);

    // Random seed per cell
    float rnd = random(grid);

    vec4 confettiColor = vec4(0.0);

    // Only some cells have confetti
    if (rnd > 0.65) {
      // Fall speed varies per particle
      float fallSpeed = 0.4 + rnd * 0.5;
      float startDelay = rnd * 0.2;

      // Adjusted time for this particle
      float particleTime = max(0.0, u_progress - startDelay);

      // Falling position
      float yOffset = particleTime * fallSpeed * 2.5;

      // Wobble
      float wobbleFreq = 4.0 + rnd * 5.0;
      float wobbleAmp = 0.02 + rnd * 0.015;
      float wobble = sin(u_time * wobbleFreq + rnd * 6.28) * wobbleAmp;

      // Rotation
      float rotation = u_time * (3.0 + rnd * 4.0);

      // Particle center position
      vec2 cellCenter = (grid + 0.5) / gridSize;
      cellCenter.y = mod(cellCenter.y + yOffset, 1.3) - 0.15;
      cellCenter.x += wobble;

      // Confetti shape (elongated rectangle)
      float size = 0.012 + rnd * 0.008;
      float stretch = 1.8 + sin(rotation) * 0.6;

      vec2 delta = v_texCoord - cellCenter;
      float angle = rotation;
      vec2 rotDelta = vec2(
        delta.x * cos(angle) - delta.y * sin(angle),
        delta.x * sin(angle) + delta.y * cos(angle)
      );
      rotDelta.x *= stretch;

      float shapeDist = max(abs(rotDelta.x), abs(rotDelta.y));
      float confettiMask = smoothstep(size, size * 0.3, shapeDist);

      // Color alternation - use multiple colors
      float colorChoice = fract(rnd * 5.0);
      if (colorChoice < 0.33) {
        confettiColor = u_primaryColor;
      } else if (colorChoice < 0.66) {
        confettiColor = u_secondaryColor;
      } else {
        confettiColor = mix(u_primaryColor, u_secondaryColor, 0.5);
      }

      // Sparkle effect
      float sparkle = sin(u_time * 25.0 + rnd * 100.0) * 0.25 + 0.75;
      confettiColor *= confettiMask * sparkle * u_intensity;
    }

    // Fade out at end
    float fade = 1.0 - smoothstep(0.75, 1.0, u_progress);

    gl_FragColor = confettiColor * fade;
  }
`;

/**
 * Diagonal Wipe Transition (Overlay Version)
 * Sweeping diagonal line with glowing edge
 * Great for transitions
 */
export const diagonalWipeShader = `
  precision mediump float;

  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec4 u_secondaryColor;

  varying vec2 v_texCoord;

  void main() {
    // Diagonal line: x + y ranges from 0 to 2
    float diagonal = v_texCoord.x + v_texCoord.y;

    // Wipe position (from -0.3 to 2.3 for smooth entry/exit)
    float wipePos = u_progress * 2.6 - 0.3;

    // Main edge glow
    float edgeWidth = 0.2;
    float edge = smoothstep(wipePos - edgeWidth, wipePos, diagonal)
               - smoothstep(wipePos, wipePos + edgeWidth * 0.2, diagonal);

    // Secondary trailing glow
    float trailWidth = 0.4;
    float trail = smoothstep(wipePos - trailWidth, wipePos - edgeWidth, diagonal)
                - smoothstep(wipePos - edgeWidth, wipePos, diagonal);

    // Gradient color along the edge
    vec4 edgeColor = mix(u_primaryColor, u_secondaryColor, v_texCoord.y);

    // Sparkle on edge
    float sparkle = sin(diagonal * 50.0 + u_progress * 20.0) * 0.2 + 0.8;

    // Combine - bright edge with dimmer trail
    vec4 result = edgeColor * edge * u_intensity * 2.0 * sparkle;
    result += u_primaryColor * trail * u_intensity * 0.3;

    gl_FragColor = result;
  }
`;

/**
 * Radial Wipe Transition (Overlay Version)
 * Circular expanding ring from center
 * Alternative transition effect
 */
export const radialWipeShader = `
  precision mediump float;

  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_center;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    // Distance from center
    vec2 toCenter = v_texCoord - u_center;
    float aspect = u_resolution.x / u_resolution.y;
    toCenter.x *= aspect;
    float dist = length(toCenter);

    // Maximum distance for normalization
    float maxDist = length(vec2(0.5 * aspect, 0.5)) * 1.3;

    // Wipe radius expands outward
    float wipeRadius = u_progress * maxDist;

    // Main ring
    float edgeWidth = 0.12;
    float edge = smoothstep(wipeRadius - edgeWidth, wipeRadius, dist)
               - smoothstep(wipeRadius, wipeRadius + edgeWidth * 0.25, dist);

    // Inner glow trail
    float trailWidth = 0.25;
    float trail = smoothstep(wipeRadius - trailWidth, wipeRadius - edgeWidth, dist)
                - smoothstep(wipeRadius - edgeWidth, wipeRadius, dist);

    // Sparkle effect
    float angle = atan(toCenter.y, toCenter.x);
    float sparkle = sin(angle * 8.0 + u_progress * 15.0) * 0.15 + 0.85;

    // Combine
    vec4 result = u_primaryColor * edge * u_intensity * 2.0 * sparkle;
    result += u_primaryColor * trail * u_intensity * 0.25;

    gl_FragColor = result;
  }
`;

/**
 * Flash Effect (Overlay Version)
 * Simple bright flash that fades
 * Quick impact effect
 */
export const flashShader = `
  precision mediump float;

  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;

  varying vec2 v_texCoord;

  void main() {
    // Flash curve: peaks early then fades quickly
    float flash = 1.0 - pow(u_progress, 0.25);
    flash = pow(flash, 1.5);

    // Slight vignette - stronger at edges
    vec2 center = v_texCoord - 0.5;
    float vignette = 1.0 - length(center) * 0.5;

    // Output flash color with alpha
    gl_FragColor = u_primaryColor * flash * u_intensity * vignette;
  }
`;

/**
 * Shake Effect (Overlay Version)
 * Visual impact lines and flash
 * Creates sense of impact/shake
 */
export const shakeShader = `
  precision mediump float;

  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec4 u_primaryColor;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  float random(float seed) {
    return fract(sin(seed * 12.9898) * 43758.5453);
  }

  void main() {
    vec2 uv = v_texCoord;

    // Effect strength diminishes over progress
    float strength = (1.0 - u_progress) * u_intensity;

    // Impact lines radiating from center
    vec2 center = uv - 0.5;
    float angle = atan(center.y, center.x);
    float dist = length(center);

    // Radial lines
    float numLines = 12.0;
    float lineAngle = mod(angle * numLines / 3.14159, 2.0);
    float line = smoothstep(0.3, 0.0, abs(lineAngle - 1.0));

    // Lines appear at edges, not center
    line *= smoothstep(0.1, 0.4, dist);
    line *= smoothstep(0.8, 0.5, dist);

    // Flicker
    float flicker = random(floor(u_time * 40.0));
    flicker = step(0.3, flicker);

    // Edge flash
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeFlash = smoothstep(0.1, 0.0, edgeDist) * (1.0 - u_progress);

    // Combine
    float effect = (line * 0.5 + edgeFlash) * strength * flicker;

    gl_FragColor = u_primaryColor * effect;
  }
`;

// =============================================================================
// PASSTHROUGH SHADER (for 'none' effect)
// =============================================================================

export const passthroughShader = `
  precision mediump float;
  varying vec2 v_texCoord;

  void main() {
    // No effect - fully transparent
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
`;

// =============================================================================
// DISTORTION SHADERS (Texture-based - transform content)
// =============================================================================

/**
 * Wave Distort - Sinusoidal wave flowing through content
 * Great for text ripple effects
 */
export const waveDistortShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Wave parameters
    float waveFreq = 15.0;
    float waveAmp = 0.03 * u_intensity;
    float waveSpeed = 3.0;

    // Progressive wave - starts from top/left and flows across
    float waveProgress = u_progress * 2.0;
    float waveFront = waveProgress - uv.y;

    // Only distort where the wave has reached
    float inWave = smoothstep(0.0, 0.3, waveFront) * smoothstep(0.6, 0.0, waveFront - 0.3);

    // Horizontal wave displacement
    float wave = sin(uv.y * waveFreq + u_time * waveSpeed) * waveAmp * inWave;

    // Apply distortion
    vec2 distortedUV = uv;
    distortedUV.x += wave;

    // Sample texture
    vec4 color = texture2D(u_texture, distortedUV);

    gl_FragColor = color;
  }
`;

/**
 * Shockwave - Circular ripple expanding from center
 */
export const shockwaveShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_center;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Distance from center
    vec2 toCenter = uv - u_center;
    float dist = length(toCenter);

    // Expanding ring
    float ringRadius = u_progress * 1.5;
    float ringWidth = 0.15;

    // Distance from ring
    float ringDist = abs(dist - ringRadius);
    float inRing = 1.0 - smoothstep(0.0, ringWidth, ringDist);

    // Distortion amount - push outward from center
    float distortAmount = inRing * 0.05 * u_intensity * (1.0 - u_progress);

    // Apply radial distortion
    vec2 distortedUV = uv + normalize(toCenter) * distortAmount;

    // Sample texture
    vec4 color = texture2D(u_texture, distortedUV);

    gl_FragColor = color;
  }
`;

/**
 * Text Ripple - Wave specifically designed for text, flows down
 */
export const textRippleShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Multiple waves flowing down
    float wave1 = sin(uv.x * 20.0 + u_time * 4.0) * 0.015;
    float wave2 = sin(uv.x * 35.0 - u_time * 3.0) * 0.008;
    float wave3 = cos(uv.x * 12.0 + u_time * 5.0) * 0.01;

    // Wave envelope - active during the effect
    float envelope = sin(u_progress * 3.14159);

    // Combined wave with intensity
    float totalWave = (wave1 + wave2 + wave3) * envelope * u_intensity;

    // Apply vertical displacement (text bounces up and down)
    vec2 distortedUV = uv;
    distortedUV.y += totalWave;

    // Small horizontal wobble too
    distortedUV.x += totalWave * 0.3;

    // Sample texture
    vec4 color = texture2D(u_texture, distortedUV);

    gl_FragColor = color;
  }
`;

/**
 * Zoom Pulse - Scale in and out from center
 */
export const zoomPulseShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_center;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Zoom amount - pulses then settles
    float zoom = 1.0 + sin(u_progress * 3.14159) * 0.1 * u_intensity;

    // Scale from center
    vec2 centered = uv - u_center;
    vec2 scaled = centered / zoom;
    vec2 distortedUV = scaled + u_center;

    // Clamp to valid range
    distortedUV = clamp(distortedUV, 0.0, 1.0);

    // Sample texture
    vec4 color = texture2D(u_texture, distortedUV);

    // Slight brightness pulse
    float brightPulse = 1.0 + sin(u_progress * 3.14159) * 0.2 * u_intensity;
    color.rgb *= brightPulse;

    gl_FragColor = color;
  }
`;

/**
 * Chromatic Aberration - RGB channel separation
 */
export const chromaticShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_center;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Direction from center
    vec2 toCenter = uv - u_center;

    // Separation amount - peaks in middle of effect
    float separation = sin(u_progress * 3.14159) * 0.02 * u_intensity;

    // Sample each channel with offset
    float r = texture2D(u_texture, uv + toCenter * separation).r;
    float g = texture2D(u_texture, uv).g;
    float b = texture2D(u_texture, uv - toCenter * separation).b;
    float a = texture2D(u_texture, uv).a;

    gl_FragColor = vec4(r, g, b, a);
  }
`;

/**
 * Pixelate - Progressive pixelation effect
 */
export const pixelateShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Pixel size - starts small, gets big, then returns to normal
    float maxPixelSize = 30.0 * u_intensity;
    float pixelSize = 1.0 + sin(u_progress * 3.14159) * maxPixelSize;

    // Pixelate UV coordinates
    vec2 pixelUV = floor(uv * u_resolution / pixelSize) * pixelSize / u_resolution;

    // Sample texture at pixelated coordinates
    vec4 color = texture2D(u_texture, pixelUV);

    gl_FragColor = color;
  }
`;

/**
 * Twist/Swirl - Rotational distortion from center
 */
export const twistShader = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;
  uniform vec2 u_center;

  varying vec2 v_texCoord;

  void main() {
    vec2 uv = v_texCoord;

    // Vector from center
    vec2 toCenter = uv - u_center;
    float dist = length(toCenter);
    float angle = atan(toCenter.y, toCenter.x);

    // Twist amount - stronger near center, peaks mid-animation
    float twistStrength = sin(u_progress * 3.14159) * u_intensity * 2.0;
    float twist = twistStrength * (1.0 - dist) * (1.0 - dist);

    // Apply rotation
    float newAngle = angle + twist;
    vec2 distortedUV = u_center + vec2(cos(newAngle), sin(newAngle)) * dist;

    // Clamp to valid range
    distortedUV = clamp(distortedUV, 0.0, 1.0);

    // Sample texture
    vec4 color = texture2D(u_texture, distortedUV);

    gl_FragColor = color;
  }
`;

// =============================================================================
// GENERATIVE SHADERS (Procedural patterns)
// =============================================================================

/**
 * Liquid Distortion - Procedural flowing liquid pattern
 * Creates psychedelic flowing colors using noise
 * Used by custom shader presets from Shader Creator
 */
export const liquidDistortionShader = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_intensity;

  // Custom liquid params (passed via uniforms)
  uniform float u_seed;
  uniform float u_colorShift;
  uniform float u_distortionAmount;
  uniform float u_noiseScale;
  uniform float u_speed;
  uniform float u_octaves;
  uniform float u_saturation;
  uniform float u_brightness;
  uniform float u_vignetteAmount;
  uniform float u_grainAmount;

  varying vec2 v_texCoord;

  // 3D Simplex noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
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

  // Fractal Brownian Motion
  float fbm(vec3 p, float octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for(float i = 0.0; i < 8.0; i++) {
      if(i >= octaves) break;
      value += amplitude * snoise(p * frequency);
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
    vec2 uv = v_texCoord;
    vec2 centeredUV = (uv - 0.5) * 2.0;
    centeredUV.x *= u_resolution.x / u_resolution.y;

    float t = u_time * u_speed;

    // Create liquid distortion using layered noise
    vec3 noisePos = vec3(centeredUV * u_noiseScale, t * 0.3 + u_seed);
    float noise1 = fbm(noisePos, u_octaves);
    float noise2 = fbm(noisePos + vec3(100.0, 50.0, t * 0.2), u_octaves);

    // Apply distortion to coordinates
    vec2 distortion = vec2(noise1, noise2) * u_distortionAmount;
    vec2 distortedUV = centeredUV + distortion * 0.3;

    // Create flowing patterns with multiple noise layers
    vec3 colorPos = vec3(distortedUV * 1.5, t * 0.2);
    float pattern1 = fbm(colorPos, u_octaves);
    float pattern2 = fbm(colorPos * 1.5 + vec3(50.0, 30.0, t * 0.15), u_octaves);
    float pattern3 = fbm(colorPos * 0.8 + vec3(-30.0, 70.0, t * 0.25), u_octaves);

    // Combine patterns for color
    float combined = pattern1 * 0.5 + pattern2 * 0.3 + pattern3 * 0.2;
    combined = combined * 0.5 + 0.5;

    // Create psychedelic colors
    float hue = mod(combined + u_colorShift + t * 0.05, 6.28) / 6.28;
    vec3 hsv = vec3(hue, u_saturation, u_brightness + pattern1 * 0.2);
    vec3 color = hsv2rgb(hsv);

    // Add some highlights/shadows based on noise
    float lighting = 0.7 + pattern2 * 0.3;
    color *= lighting;

    // Bloom effect
    float bloom = smoothstep(0.6, 1.0, length(color));
    color += bloom * color * 0.3;

    // Vignette
    float vignette = 1.0 - length(centeredUV) * u_vignetteAmount;
    color *= vignette;

    // Add grain
    float grain = fract(sin(dot(uv + u_time * 0.001, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * u_grainAmount;

    // Apply intensity
    color *= u_intensity;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// =============================================================================
// SHADER REGISTRY
// =============================================================================

export const fragmentShaders: Record<EffectName, string> = {
  // Overlay effects
  none: passthroughShader,
  scoreBurst: scoreBurstShader,
  pulseGlow: pulseGlowShader,
  glitch: glitchShader,
  ripple: rippleShader,
  confetti: confettiShader,
  diagonalWipe: diagonalWipeShader,
  radialWipe: radialWipeShader,
  flash: flashShader,
  shake: shakeShader,
  // Distortion effects (texture-based)
  waveDistort: waveDistortShader,
  shockwave: shockwaveShader,
  textRipple: textRippleShader,
  zoomPulse: zoomPulseShader,
  chromatic: chromaticShader,
  pixelate: pixelateShader,
  twist: twistShader,
  // Generative effects (procedural)
  liquidDistortion: liquidDistortionShader,
};

// =============================================================================
// EFFECT DEFINITIONS
// =============================================================================

export const effectDefinitions: EffectDefinition[] = [
  {
    name: 'none',
    label: 'None',
    description: 'No effect',
    category: 'ambient',
    defaultDuration: 0,
    defaultIntensity: 0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'scoreBurst',
    label: 'Score Burst',
    description: 'Radial burst with expanding rings - great for scoring events',
    category: 'score',
    defaultDuration: 1.2,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: false,
  },
  {
    name: 'pulseGlow',
    label: 'Pulse Glow',
    description: 'Pulsing glow around element edges',
    category: 'ambient',
    defaultDuration: 2.0,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: false,
  },
  {
    name: 'glitch',
    label: 'Glitch',
    description: 'Digital glitch with RGB split and scanlines',
    category: 'score',
    defaultDuration: 0.8,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'ripple',
    label: 'Ripple',
    description: 'Concentric waves emanating from center',
    category: 'score',
    defaultDuration: 1.5,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'confetti',
    label: 'Confetti',
    description: 'Falling colorful confetti particles',
    category: 'celebration',
    defaultDuration: 3.0,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: true,
  },
  {
    name: 'diagonalWipe',
    label: 'Diagonal Wipe',
    description: 'Diagonal sweeping transition',
    category: 'transition',
    defaultDuration: 1.0,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: true,
  },
  {
    name: 'radialWipe',
    label: 'Radial Wipe',
    description: 'Circular reveal from center',
    category: 'transition',
    defaultDuration: 1.0,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: false,
  },
  {
    name: 'flash',
    label: 'Flash',
    description: 'Quick bright flash',
    category: 'score',
    defaultDuration: 0.5,
    defaultIntensity: 1.0,
    supportsColor: true,
    supportsSecondaryColor: false,
  },
  {
    name: 'shake',
    label: 'Shake',
    description: 'Screen shake / vibration effect',
    category: 'score',
    defaultDuration: 0.6,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  // Distortion effects (texture-based)
  {
    name: 'waveDistort',
    label: 'Wave Distort',
    description: 'Flowing wave distortion through content',
    category: 'distortion',
    defaultDuration: 1.5,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'shockwave',
    label: 'Shockwave',
    description: 'Expanding circular shockwave from center',
    category: 'distortion',
    defaultDuration: 1.0,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'textRipple',
    label: 'Text Ripple',
    description: 'Rippling wave effect ideal for text',
    category: 'distortion',
    defaultDuration: 1.2,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'zoomPulse',
    label: 'Zoom Pulse',
    description: 'Quick zoom in/out pulse from center',
    category: 'distortion',
    defaultDuration: 0.8,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'chromatic',
    label: 'Chromatic',
    description: 'RGB channel separation effect',
    category: 'distortion',
    defaultDuration: 1.0,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'pixelate',
    label: 'Pixelate',
    description: 'Progressive pixelation and return',
    category: 'distortion',
    defaultDuration: 1.0,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  {
    name: 'twist',
    label: 'Twist',
    description: 'Swirling twist distortion from center',
    category: 'distortion',
    defaultDuration: 1.2,
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
  // Generative effects
  {
    name: 'liquidDistortion',
    label: 'Liquid Pattern',
    description: 'Flowing liquid color pattern (use custom presets)',
    category: 'ambient',
    defaultDuration: 0, // Continuous - no end
    defaultIntensity: 1.0,
    supportsColor: false,
    supportsSecondaryColor: false,
  },
];

// Helper to get effect definition by name
export function getEffectDefinition(name: EffectName): EffectDefinition | undefined {
  return effectDefinitions.find(e => e.name === name);
}

// Get effects by category
export function getEffectsByCategory(category: EffectDefinition['category']): EffectDefinition[] {
  return effectDefinitions.filter(e => e.category === category && e.name !== 'none');
}
