/**
 * Type definitions for CustomDataDisplay component.
 */

export interface CustomDataDisplayProps {
  dataPath: string;
  gameData?: any;
  label?: string;
  backgroundColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  format?: 'number' | 'text' | 'time' | 'boolean';
  prefix?: string;
  suffix?: string;
  customText?: string;
  textAlign?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  imageSource?: 'none' | 'local' | 'url';
  imagePath?: string;
  imageUrl?: string;
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
  imageAnchor?: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  imageTintColor?: string;
  useImageTint?: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: string;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  useTeamColor?: boolean;
  teamColorSide?: 'home' | 'away';
  autoFitText?: boolean;
  minFontScale?: number;
  previewText?: string;
  canToggle?: boolean;
  toggleState?: boolean;
  state1Props?: any;
  state2Props?: any;
  autoToggle?: boolean;
  toggleDataPath?: string;
  visibilityPath?: string;
  isVisible?: boolean;
  fontFamily?: string;
  // Multi-state support (for penalty boxes with 0-3 states)
  multiStateEnabled?: boolean;
  statePath?: string;
  stateImages?: Record<string, string>;
  // Auto contrast
  autoContrastText?: boolean;
}
