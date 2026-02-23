// =============================================================================
// TEXT BEARING MEASUREMENT UTILITY
// =============================================================================
// Measures the actual pixel bearing (whitespace) around text glyphs using
// Canvas TextMetrics. These values can be exported with layouts so the TV app
// can position text identically without needing its own measurement API.
// =============================================================================

// Font family mapping (matches CustomDataDisplay FONT_CONFIG)
const FONT_FAMILY_MAP: Record<string, string> = {
  'Score-Regular': 'Score-Regular',
  'Helvetica-Bold': 'Helvetica, Arial, sans-serif',
  'Inter-Bold': 'Inter-Bold',
  'Roboto-Bold': 'Roboto-Bold',
  'Montserrat-Bold': 'Montserrat-Bold',
  'Oswald-Bold': 'Oswald-Bold',
  'BebasNeue': 'BebasNeue',
  'Anton': 'Anton',
  'Teko-Bold': 'Teko-Bold',
};

/**
 * Measure the left and right bearing of text using Canvas TextMetrics.
 *
 * @param text - The text to measure
 * @param fontFamily - Font family key (e.g., 'Score-Regular')
 * @param fontSize - Font size in pixels
 * @returns Object with leftBearing and rightBearing in pixels
 */
export function measureTextBearings(
  text: string,
  fontFamily: string,
  fontSize: number
): { leftBearing: number; rightBearing: number } {
  if (typeof document === 'undefined' || !text) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  // Map font family key to actual CSS font
  const cssFontFamily = FONT_FAMILY_MAP[fontFamily] || fontFamily;
  ctx.font = `bold ${fontSize}px ${cssFontFamily}`;
  const metrics = ctx.measureText(text);

  // Left bearing: distance from origin to leftmost pixel
  const leftBearing = metrics.actualBoundingBoxLeft || 0;

  // Right bearing: distance from rightmost pixel to end of advance width
  const advanceWidth = metrics.width || 0;
  const actualBoundingBoxRight = metrics.actualBoundingBoxRight || advanceWidth;
  const rightBearing = Math.max(0, advanceWidth - actualBoundingBoxRight);

  return {
    leftBearing: Math.round(leftBearing * 100) / 100, // Round to 2 decimal places
    rightBearing: Math.round(rightBearing * 100) / 100,
  };
}

/**
 * Get sample text for bearing measurement based on component props.
 * Uses representative characters to get accurate bearing values.
 */
export function getSampleTextForBearing(props: {
  dataPath?: string;
  customText?: string;
  prefix?: string;
  suffix?: string;
}): string {
  // If custom text is set, use it
  if (props.customText) {
    return `${props.prefix || ''}${props.customText}${props.suffix || ''}`;
  }

  // Use representative sample text based on data path
  // These should match typical values that will be displayed
  const sampleValues: Record<string, string> = {
    'homeTeam.score': '00',
    'awayTeam.score': '00',
    'homeTeam.name': 'HOME',
    'awayTeam.name': 'AWAY',
    'homeTeam.fouls': '0',
    'awayTeam.fouls': '0',
    'period': '1',
    'gameClock': '00:00',
    'shotClock': '24',
  };

  const baseText = sampleValues[props.dataPath || ''] || '00';
  return `${props.prefix || ''}${baseText}${props.suffix || ''}`;
}
