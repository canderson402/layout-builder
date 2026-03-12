/**
 * CustomDataDisplay module exports.
 */

export { getFontConfig, getTextBearings, FONT_CONFIG } from './fontConfig';
export type { FontConfig } from './fontConfig';

export { mockGameData, mockBannerData } from './mockGameData';

export {
  formatColor,
  getLuminance,
  getContrastTextColor,
  getTeamColor,
} from './colorUtils';

export {
  resolveImagePath,
  isImageDataPath,
  getImageSource,
  getAnchorAlignment,
} from './imageUtils';
export type { ImageAnchor } from './imageUtils';

export type { CustomDataDisplayProps } from './types';
