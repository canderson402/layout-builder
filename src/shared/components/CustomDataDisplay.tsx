import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

interface CustomDataDisplayProps {
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
  canToggle?: boolean;
  toggleState?: boolean;
  state1Props?: any;
  state2Props?: any;
  autoToggle?: boolean; // Whether to automatically use boolean data values for toggle state
}

// Mock data for preview in layout builder
const mockData = {
  homeTeam: {
    name: 'HOME',
    score: 1,
    fouls: 4,
    timeouts: 3,
    bonus: true,
    doubleBonus: false,
    possession: false, // Changed to false for testing
    color: '#c41e3a'
  },
  awayTeam: {
    name: 'AWAY',
    score: 0,
    fouls: 6,
    timeouts: 2,
    bonus: false,
    doubleBonus: true,
    possession: true, // Changed to true for testing
    color: '#003f7f'
  },
  gameClock: '5:42',
  activityClock: '1:30',
  timeoutClock: '0:30',
  timerName: 'Timer Name',
  sessionName: 'Session Name',
  nextUp: 'Next Up',
  period: 4,
  shotClock: 14,
  quarter: 4,
  half: 2,
  set: 3,
  isOvertime: false,
  home_sets_won: 0,
  away_sets_won: 0,
  home_team_color: '#c41e3a',
  away_team_color: '#003f7f'
};

export default function CustomDataDisplay(props: CustomDataDisplayProps) {
  const {
    dataPath = 'gameClock',
    gameData, // Don't set default here, handle it below
    width = 100,
    height = 50,
    canToggle = false,
    toggleState = false,
    state1Props = {},
    state2Props = {},
    autoToggle = true,
    useTeamColor = false,
    teamColorSide = 'home',
    imageTintColor,
    useImageTint = false,
    ...defaultProps
  } = props;

  // Banner rotation state for layout builder preview
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mock banner data for layout builder preview
  const mockBannerData = {
    entries: [
      {
        id: 1,
        image: { url: 'https://via.placeholder.com/300x100/FF0000/FFFFFF?text=Banner+1' },
        rotation_interval: 3
      },
      {
        id: 2,
        image: { url: 'https://via.placeholder.com/300x100/00FF00/FFFFFF?text=Banner+2' },
        rotation_interval: 3
      },
      {
        id: 3,
        image: { url: 'https://via.placeholder.com/300x100/0000FF/FFFFFF?text=Banner+3' },
        rotation_interval: 3
      }
    ]
  };

  // Banner rotation logic for layout builder
  useEffect(() => {
    if (dataPath === 'user_sequences.banner') {
      const bannerEntries = mockBannerData.entries;

      if (bannerEntries.length > 1) {
        // Clear any existing timer
        if (bannerTimerRef.current) {
          clearInterval(bannerTimerRef.current);
        }

        // Use 3 second intervals for layout builder preview
        bannerTimerRef.current = setInterval(() => {
          setCurrentBannerIndex((prevIndex) =>
            prevIndex >= bannerEntries.length - 1 ? 0 : prevIndex + 1
          );
        }, 3000);
      }

      return () => {
        if (bannerTimerRef.current) {
          clearInterval(bannerTimerRef.current);
        }
      };
    }
  }, [dataPath]);

  // Use provided gameData or fall back to mockData, prioritizing the dynamic data
  const effectiveGameData = gameData || mockData;

  // Helper function to get nested data using dot notation
  const getNestedData = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Determine the effective toggle state
  const getEffectiveToggleState = () => {
    if (!canToggle) return false;

    // In layout builder, always use manual toggle state for preview
    return toggleState;
  };

  const effectiveToggleState = getEffectiveToggleState();

  // Merge the appropriate state props based on effective toggle state
  // Keep dataPath at base level, only merge visual/formatting properties
  const baseProps = { dataPath, useTeamColor, teamColorSide, imageTintColor, useImageTint };
  const visualProps = canToggle ?
    (effectiveToggleState ? { ...defaultProps, ...state2Props } : { ...defaultProps, ...state1Props }) :
    defaultProps;
  const activeProps = { ...baseProps, ...visualProps };
  
  // Extract all properties from the active props
  const {
    label,
    backgroundColor = '#000000',
    textColor = '#ffffff',
    fontSize = 24,
    format = 'text',
    prefix = '',
    suffix = '',
    textAlign = 'center',
    paddingTop = 0,
    paddingRight = 0,
    paddingBottom = 0,
    paddingLeft = 0,
    imageSource = 'none',
    imagePath,
    imageUrl,
    objectFit = 'fill',
    imageAnchor = 'center',
    imageTintColor: effectiveImageTintColor,
    useImageTint: effectiveUseImageTint = false,
    borderWidth = 0,
    borderColor = '#ffffff',
    borderStyle = 'solid',
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopLeftRadius = 0,
    borderTopRightRadius = 0,
    borderBottomLeftRadius = 0,
    borderBottomRightRadius = 0
  } = activeProps;
  
  // State to track image natural dimensions for native resolution mode
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  // Helper function to ensure proper hex color format and handle black/empty colors
  const formatColor = (color: string | undefined): string | undefined => {
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

  // Determine effective colors based on team color settings
  // For tint, we want to use team colors even in preview (mockData)
  // For background color, we only use team colors with real game data
  const hasRealGameData = effectiveGameData && effectiveGameData !== mockData && (effectiveGameData.home_team_color || effectiveGameData.away_team_color);
  const hasAnyTeamColorData = effectiveGameData && (effectiveGameData.home_team_color || effectiveGameData.away_team_color);

  // Only use team color for background if NOT using image tint
  // This prevents team color from affecting both background and tint at the same time
  const teamColorForBackground = useTeamColor && teamColorSide && hasRealGameData && !effectiveUseImageTint ?
    formatColor(teamColorSide === 'home' ? effectiveGameData.home_team_color : effectiveGameData.away_team_color) :
    undefined;

  // Only use team color for tint if image tint is enabled
  const teamColorForTint = useTeamColor && teamColorSide && hasAnyTeamColorData && effectiveUseImageTint ?
    formatColor(teamColorSide === 'home' ? effectiveGameData.home_team_color : effectiveGameData.away_team_color) :
    undefined;

  // Use team color if available, otherwise use the active background/text colors
  const effectiveBackgroundColor = teamColorForBackground || backgroundColor;
  const effectiveTextColor = teamColorForBackground ? '#ffffff' : textColor;

  // Calculate effective tint color for image masking
  const effectiveTintColor = effectiveUseImageTint ?
    (teamColorForTint || formatColor(effectiveImageTintColor)) :
    undefined;

  // Get the data value
  const rawValue = getNestedData(effectiveGameData, dataPath);

  // For boolean data paths with toggle enabled, don't show text - just show the visual state
  const isBooleanToggle = canToggle && typeof rawValue === 'boolean';

  // Format the value based on the format type
  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return '--';
    }

    switch (format) {
      case 'number':
        return Number(value).toString();
      case 'time':
        return typeof value === 'string' ? value : `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`;
      case 'boolean':
        return value ? 'YES' : 'NO';
      case 'text':
      default:
        return String(value);
    }
  };

  const formattedValue = formatValue(rawValue);
  // Don't show text for boolean toggles, just show the visual state
  const displayText = (!dataPath || dataPath.trim() === '' || dataPath === 'none' || isBooleanToggle) ? '' : `${prefix}${formattedValue}${suffix}`;

  // Convert textAlign to flexbox alignment
  const getJustifyContent = () => {
    switch (textAlign) {
      case 'left': return 'left';
      case 'right': return 'right';
      case 'center':
      default: return 'center';
    }
  };

  // Get image source
  const getImageSource = () => {
    // Handle banner ads
    if (dataPath === 'user_sequences.banner') {
      const bannerEntries = mockBannerData.entries;
      if (bannerEntries.length > 0) {
        const currentEntry = bannerEntries[currentBannerIndex] || bannerEntries[0];
        return { uri: currentEntry.image?.url };
      }
      return null;
    }

    if (imageSource === 'local' && imagePath) {
      return { uri: imagePath };
    }
    if (imageSource === 'url' && imageUrl) {
      return { uri: imageUrl };
    }
    return null;
  };

  const imageSourceObj = getImageSource();

  // Debug logging for tint
  if (imageSourceObj && effectiveUseImageTint) {
    console.log('Tint Debug (Web):', {
      useImageTint: effectiveUseImageTint,
      imageTintColor: effectiveImageTintColor,
      teamColorForTint,
      effectiveTintColor,
      imagePath
    });
  }

  // For native resolution mode with contain behavior - always use container dimensions
  // The image will scale to fit within the bounds while maintaining aspect ratio
  const containerWidth = width;
  const containerHeight = height;

  // Convert anchor point to flexbox alignment
  const getAnchorAlignment = () => {
    switch (imageAnchor) {
      case 'top-left':
        return { justifyContent: 'flex-start', alignItems: 'flex-start' };
      case 'top-right':
        return { justifyContent: 'flex-start', alignItems: 'flex-end' };
      case 'bottom-left':
        return { justifyContent: 'flex-end', alignItems: 'flex-start' };
      case 'bottom-right':
        return { justifyContent: 'flex-end', alignItems: 'flex-end' };
      case 'center':
      default:
        return { justifyContent: 'center', alignItems: 'center' };
    }
  };

  const anchorAlignment = getAnchorAlignment();

  return (
    <View style={{
      width: containerWidth,
      height: containerHeight,
      backgroundColor: effectiveBackgroundColor,
      justifyContent: imageSourceObj ? anchorAlignment.justifyContent : 'center',
      alignItems: imageSourceObj ? anchorAlignment.alignItems : 'center',
      // Apply border properties
      borderWidth: imageSourceObj ? 0 : borderWidth,
      borderColor: imageSourceObj ? 'transparent' : borderColor,
      borderStyle: borderStyle,
      borderTopWidth: borderTopWidth !== undefined ? borderTopWidth : borderWidth,
      borderBottomWidth: borderBottomWidth !== undefined ? borderBottomWidth : borderWidth,
      borderLeftWidth: borderLeftWidth !== undefined ? borderLeftWidth : borderWidth,
      borderRightWidth: borderRightWidth !== undefined ? borderRightWidth : borderWidth,
      borderTopLeftRadius: borderTopLeftRadius,
      borderTopRightRadius: borderTopRightRadius,
      borderBottomLeftRadius: borderBottomLeftRadius,
      borderBottomRightRadius: borderBottomRightRadius,
      // For images: use zero padding so image fills container exactly
      // For text: add padding for readability
      paddingTop: imageSourceObj ? 0 : (paddingTop + 4),
      paddingRight: imageSourceObj ? 0 : (paddingRight + 4),
      paddingBottom: imageSourceObj ? 0 : (paddingBottom + 4),
      paddingLeft: imageSourceObj ? 0 : (paddingLeft + 4),
      position: 'relative',
      flexDirection: 'column'
    }}>
      {imageSourceObj ? (
        // Render image
        <>
          {label && (
            <View style={{
              width: '100%',
              justifyContent: getJustifyContent(),
              alignItems: 'center',
              flexDirection: 'row',
              marginBottom: 4
            }}>
              <Text style={{
                fontSize: fontSize * 0.6,
                color: effectiveTextColor,
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {label}
              </Text>
            </View>
          )}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {effectiveTintColor && effectiveUseImageTint ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: effectiveTintColor,
                  WebkitMaskImage: `url(${imageSourceObj.uri})`,
                  maskImage: `url(${imageSourceObj.uri})`,
                  WebkitMaskSize: objectFit === 'none' || objectFit === 'fill' ? '100% 100%' : objectFit,
                  maskSize: objectFit === 'none' || objectFit === 'fill' ? '100% 100%' : objectFit,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
            ) : (
              <img
                src={imageSourceObj.uri}
                alt={label || 'Custom image'}
                style={{
                  ...(objectFit === 'none' ? {
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill'
                  } : {
                    width: '100%',
                    height: '100%',
                    objectFit: objectFit
                  }),
                  display: 'block'
                }}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setImageDimensions({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  });
                }}
                onError={(e) => {
                  console.error('Failed to load image:', imageSourceObj.uri);
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        </>
      ) : (
        // Render text content
        <>
          {label && (
            <View style={{
              width: '100%',
              justifyContent: getJustifyContent(),
              alignItems: 'center',
              flexDirection: 'row'
            }}>
              <Text style={{
                fontSize: fontSize * 0.6,
                color: effectiveTextColor,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                marginBottom: 2
              }}>
                {label}
              </Text>
            </View>
          )}
          <View style={{
            width: '100%',
            justifyContent: getJustifyContent(),
            alignItems: 'center',
            flexDirection: 'row'
          }}>
            <Text style={{
              fontSize,
              color: textColor,
              fontWeight: 'bold'
            }}>
              {displayText}
            </Text>
          </View>
        </>
      )}
      {/* Show data path for debugging */}
      <Text style={{
        fontSize: 8,
        color: effectiveTextColor,
        opacity: 0.5,
        position: 'absolute',
        bottom: 2,
        right: 2
      }}>
        {imageSourceObj ? 'Image' : (dataPath || 'No data selected')}
      </Text>
      {/* Show toggle indicator if can toggle */}
      {canToggle && (
        <View style={{
          position: 'absolute',
          top: 2,
          right: 2,
          backgroundColor: effectiveToggleState ? '#4CAF50' : '#666',
          borderRadius: 6,
          width: 12,
          height: 12,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.5)'
        }} />
      )}
    </View>
  );
}