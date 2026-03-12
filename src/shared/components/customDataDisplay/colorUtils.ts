/**
 * Color utilities for CustomDataDisplay.
 * Handles color formatting, team colors, and auto-contrast calculations.
 */

/**
 * Ensures proper hex color format and filters out black/empty colors.
 */
export const formatColor = (color: string | undefined): string | undefined => {
  if (!color) return undefined;
  const colorStr = color.toString().trim();
  if (!colorStr) return undefined;

  const formatted = colorStr.startsWith('#') ? colorStr : `#${colorStr}`;

  // Don't use black as team color - it's likely an unset/default value
  if (formatted === '#000000' || formatted === '#000') {
    return undefined;
  }

  return formatted;
};

/**
 * Calculates relative luminance of a color for WCAG contrast calculations.
 */
export const getLuminance = (hexColor: string | undefined): number => {
  if (!hexColor) return 0;
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return 0;

  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  }

  // Apply gamma correction
  r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Returns black or white text color based on background luminance.
 */
export const getContrastTextColor = (bgColor: string | undefined): string => {
  const luminance = getLuminance(bgColor);
  return luminance > 0.4 ? '#000000' : '#ffffff';
};

/**
 * Gets team color from game data for a specific side.
 */
export const getTeamColor = (
  gameData: any,
  side: 'home' | 'away'
): string | undefined => {
  if (!gameData) return undefined;
  const color = side === 'home' ? gameData.home_team_color : gameData.away_team_color;
  return formatColor(color);
};
