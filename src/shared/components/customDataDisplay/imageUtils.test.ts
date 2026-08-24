import { describe, expect, it } from 'vitest';
import { getImageSource } from './imageUtils';

const NO_BANNER = { entries: [] };

describe('getImageSource precedence', () => {
  it('prefers a resolved image dataPath over a leftover local placeholder', () => {
    const result = getImageSource(
      'local',
      '/images/face.png',
      undefined,
      'accolade.imageUrl',
      'https://cdn.example/player.jpg',
      NO_BANNER,
      0,
    );
    expect(result).toEqual({ uri: 'https://cdn.example/player.jpg' });
  });

  it('falls back to the local placeholder when the bind resolves to nothing', () => {
    const result = getImageSource(
      'local',
      '/images/face.png',
      undefined,
      'accolade.imageUrl',
      '',
      NO_BANNER,
      0,
    );
    expect(result?.uri).toContain('images/face.png');
  });

  it('falls back to the local placeholder when the bound value is not a usable url', () => {
    const result = getImageSource(
      'local',
      '/images/face.png',
      undefined,
      'accolade.imageUrl',
      '--',
      NO_BANNER,
      0,
    );
    expect(result?.uri).toContain('images/face.png');
  });

  it('ignores a non-image dataPath and uses the explicit url', () => {
    const result = getImageSource(
      'url',
      undefined,
      'https://cdn.example/static.png',
      'accolade.playerName',
      'Jane Doe',
      NO_BANNER,
      0,
    );
    expect(result).toEqual({ uri: 'https://cdn.example/static.png' });
  });
});
