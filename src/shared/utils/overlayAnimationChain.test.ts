import { describe, expect, it } from 'vitest';
import { sampleTracks, type AnimationTrack } from './overlayTimeline';
import { composePreview } from './overlayPreview';
import { buildCssTransform } from './componentTransform';

const AUTHORED = { width: 100, height: 50 };

const track = (property: AnimationTrack['property'], from: number, to: number): AnimationTrack => ({
  componentId: 'c1',
  property,
  keyframes: [
    { frame: 0, value: from, interpolation: 'linear' },
    { frame: 30, value: to, interpolation: 'linear' },
  ],
});

describe('size keyframes reach the rendered transform', () => {
  it('carries a width keyframe all the way to scaleX', () => {
    const sampled = sampleTracks([track('width', 100, 400)], 30).get('c1');
    expect(sampled?.width).toBe(400);

    const composed = composePreview({ x: 0, y: 0 }, AUTHORED, undefined, sampled);
    expect(composed.stretch.x).toBe(4);

    expect(buildCssTransform(composed.transform, composed.stretch)).toContain('scaleX(4)');
  });

  it('carries a height keyframe all the way to scaleY', () => {
    const sampled = sampleTracks([track('height', 50, 25)], 30).get('c1');
    const composed = composePreview({ x: 0, y: 0 }, AUTHORED, undefined, sampled);
    expect(composed.stretch.y).toBe(0.5);
    expect(buildCssTransform(composed.transform, composed.stretch)).toContain('scaleY(0.5)');
  });

  it('emits a transform even when rotation and scale are untouched', () => {
    const sampled = sampleTracks([track('width', 100, 200)], 30).get('c1');
    const composed = composePreview({ x: 0, y: 0 }, AUTHORED, undefined, sampled);
    const css = buildCssTransform(composed.transform, composed.stretch);
    expect(css).toBeDefined();
    expect(css).toContain('rotate(0deg)');
    expect(css).toContain('scaleX(2)');
  });

  it('produces no transform at all when nothing is animated', () => {
    expect(buildCssTransform(undefined, { x: 1, y: 1 })).toBeUndefined();
  });

  it('interpolates size mid-segment rather than snapping', () => {
    const sampled = sampleTracks([track('width', 100, 300)], 15).get('c1');
    const composed = composePreview({ x: 0, y: 0 }, AUTHORED, undefined, sampled);
    expect(composed.size.width).toBe(200);
    expect(composed.stretch.x).toBe(2);
  });
});
