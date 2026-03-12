/**
 * Font configuration for CustomDataDisplay.
 * Defines web font mappings and bearing ratios for text alignment.
 */

export interface FontConfig {
  web: string;
  dyOffset: string;
  leftBearingRatio: number;
  rightBearingRatio: number;
}

export const FONT_CONFIG: Record<string, FontConfig> = {
  'Score-Regular': {
    web: 'Score-Regular',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Helvetica-Bold': {
    web: 'Helvetica, Arial, sans-serif',
    dyOffset: '0.35em',
    leftBearingRatio: 0.06,
    rightBearingRatio: 0.06,
  },
  'Inter-Bold': {
    web: 'Inter-Bold',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Roboto-Bold': {
    web: 'Roboto-Bold',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Montserrat-Bold': {
    web: 'Montserrat-Bold',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Oswald-Bold': {
    web: 'Oswald-Bold',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'BebasNeue': {
    web: 'BebasNeue',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Anton': {
    web: 'Anton',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
  'Teko-Bold': {
    web: 'Teko-Bold',
    dyOffset: '0.35em',
    leftBearingRatio: 0.05,
    rightBearingRatio: 0.05,
  },
};

const DEFAULT_FONT = 'Score-Regular';

export const getFontConfig = (fontFamily: string): FontConfig => {
  return FONT_CONFIG[fontFamily] || FONT_CONFIG[DEFAULT_FONT];
};

/**
 * Measures text bearings using Canvas TextMetrics.
 * Used for flush text alignment compensation.
 */
export const getTextBearings = (
  text: string,
  fontFamily: string,
  fontSize: number
): { leftBearing: number; rightBearing: number } => {
  if (typeof document === 'undefined' || !text) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);

  const leftBearing = metrics.actualBoundingBoxLeft || 0;
  const advanceWidth = metrics.width || 0;
  const actualBoundingBoxRight = metrics.actualBoundingBoxRight || advanceWidth;
  const rightBearing = Math.max(0, advanceWidth - actualBoundingBoxRight);

  return { leftBearing, rightBearing };
};
