import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ShapeSvg from './ShapeSvg';

const RECT_SHAPE = {
  closed: true,
  vertices: [
    { x: 0, y: 0, type: 'corner' as const },
    { x: 1, y: 0, type: 'corner' as const },
    { x: 1, y: 1, type: 'corner' as const },
    { x: 0, y: 1, type: 'corner' as const },
  ],
};

describe('ShapeSvg', () => {
  it('renders a solid-fill path', () => {
    const html = renderToStaticMarkup(
      <ShapeSvg id="c1" shape={RECT_SHAPE} width={100} height={50} fillType="solid" fillColor="#ff0000" />
    );
    expect(html).toContain('d="M 0 0 L 100 0 L 100 50 L 0 50 Z"');
    expect(html).toContain('fill="#ff0000"');
  });

  it('renders gradient defs and references them', () => {
    const html = renderToStaticMarkup(
      <ShapeSvg
        id="c2"
        shape={RECT_SHAPE}
        width={100}
        height={50}
        fillType="gradient"
        gradient={{ type: 'linear', angle: 0, stops: [{ offset: 0, color: '#111111' }, { offset: 1, color: '#222222' }] }}
      />
    );
    expect(html).toContain('linearGradient');
    expect(html).toContain('id="shape-fill-c2"');
    expect(html).toContain('fill="url(#shape-fill-c2)"');
  });

  it('team color overrides gradient and normalizes bare hex', () => {
    const html = renderToStaticMarkup(
      <ShapeSvg
        id="c3"
        shape={RECT_SHAPE}
        width={100}
        height={50}
        fillType="gradient"
        gradient={{ type: 'linear', angle: 0, stops: [{ offset: 0, color: '#111111' }, { offset: 1, color: '#222222' }] }}
        useTeamColor
        teamColorSide="home"
        gameData={{ home_team_color: '1f2a3b' }}
      />
    );
    expect(html).toContain('fill="#1f2a3b"');
    expect(html).not.toContain('linearGradient');
  });

  it('renders stroke-only open paths', () => {
    const html = renderToStaticMarkup(
      <ShapeSvg
        id="c4"
        shape={{ closed: false, vertices: RECT_SHAPE.vertices.slice(0, 2) }}
        width={200}
        height={20}
        fillType="none"
        strokeWidth={4}
        strokeColor="#ffffff"
        strokeDash={[8, 4]}
      />
    );
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('stroke-dasharray="8 4"');
    expect(html).not.toContain('Z"');
  });

  it('resolves per-stop team colors in gradients', () => {
    const html = renderToStaticMarkup(
      <ShapeSvg
        id="c5"
        shape={RECT_SHAPE}
        width={100}
        height={50}
        fillType="gradient"
        gradient={{
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#111111', teamColor: 'home' },
            { offset: 0.5, color: '#333333', teamColor: 'away' },
            { offset: 1, color: '#222222' },
          ],
        }}
        gameData={{ home_team_color: '1f2a3b', away_team_color: 'aabbcc' }}
      />
    );
    expect(html).toContain('stop-color="#1f2a3b"');
    expect(html).toContain('stop-color="#aabbcc"');
    expect(html).toContain('stop-color="#222222"');
  });
});
