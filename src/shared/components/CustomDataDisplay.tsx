import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { getFontConfig } from './customDataDisplay/fontConfig';
import { mockGameData, mockBannerData } from './customDataDisplay/mockGameData';
import {
  formatColor,
  getContrastTextColor,
  getTeamColor,
} from './customDataDisplay/colorUtils';
import {
  getImageSource,
  getAnchorAlignment,
} from './customDataDisplay/imageUtils';
import type { CustomDataDisplayProps } from './customDataDisplay/types';

export default function CustomDataDisplay(props: CustomDataDisplayProps) {
  const {
    dataPath = 'gameClock',
    gameData,
    width = 100,
    height = 50,
    canToggle = false,
    toggleState = false,
    state1Props = {},
    state2Props = {},
    toggleDataPath,
    visibilityPath,
    isVisible: isVisibleProp,
    useTeamColor = false,
    teamColorSide = 'home',
    imageTintColor,
    useImageTint = false,
    multiStateEnabled = false,
    statePath,
    stateImages,
    autoContrastText = false,
    ...defaultProps
  } = props;

  // Banner rotation state
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Image retry state
  const [imageRetryCount, setImageRetryCount] = useState(0);
  const maxImageRetries = 3;

  // Time of day state
  const isTimeOfDay = dataPath === 'timeOfDay';
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState<string>(() => {
    if (!isTimeOfDay) return '';
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!isTimeOfDay) return;

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const displayHours = hours % 12 || 12;
      setCurrentTimeOfDay(`${displayHours}:${minutes.toString().padStart(2, '0')}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isTimeOfDay]);

  // Reset retry count when image path changes
  useEffect(() => {
    setImageRetryCount(0);
  }, [defaultProps.imagePath, defaultProps.imageUrl]);

  // Banner rotation logic
  useEffect(() => {
    if (dataPath === 'user_sequences.banner') {
      const bannerEntries = mockBannerData.entries;

      if (bannerEntries.length > 1) {
        if (bannerTimerRef.current) {
          clearInterval(bannerTimerRef.current);
        }

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

  const effectiveGameData = gameData || mockGameData;

  // Helper function to get nested data using dot notation
  const getNestedData = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Visibility check
  const isVisible = isVisibleProp !== undefined ? isVisibleProp : (() => {
    if (visibilityPath && effectiveGameData) {
      const visibilityValue = getNestedData(effectiveGameData, visibilityPath);
      if (typeof visibilityValue === 'boolean') {
        return visibilityValue;
      }
    }
    return true;
  })();

  // Compute effective toggle state
  const effectiveToggleState = (() => {
    if (!canToggle) return false;

    if (toggleDataPath) {
      const rawValue = getNestedData(effectiveGameData, toggleDataPath);
      if (typeof rawValue === 'boolean') return rawValue;
    }

    if (dataPath) {
      const rawValue = getNestedData(effectiveGameData, dataPath);
      if (typeof rawValue === 'boolean') return rawValue;
    }

    return toggleState;
  })();

  // Multi-state image support
  const multiStateImagePath = (() => {
    if (!multiStateEnabled || !statePath || !stateImages) return null;
    const stateValue = getNestedData(effectiveGameData, statePath);
    const stateKey = String(stateValue ?? 0);
    return stateImages[stateKey] || stateImages['0'] || null;
  })();

  const propsWithMultiState = multiStateEnabled && multiStateImagePath
    ? { ...defaultProps, imagePath: multiStateImagePath }
    : defaultProps;

  // Merge props based on toggle state
  const baseProps = { dataPath, useTeamColor, teamColorSide, imageTintColor, useImageTint };
  const visualProps = canToggle
    ? (effectiveToggleState ? { ...propsWithMultiState, ...state2Props } : { ...propsWithMultiState, ...state1Props })
    : propsWithMultiState;
  const activeProps = { ...baseProps, ...visualProps };

  // Extract all properties
  const {
    label,
    backgroundColor = 'transparent',
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
    flipHorizontal = false,
    flipVertical = false,
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
    borderBottomRightRadius = 0,
    fontFamily = 'Score-Regular',
    autoFitText = false
  } = activeProps;

  // Determine colors
  const hasRealGameData = effectiveGameData && effectiveGameData !== mockGameData &&
    (effectiveGameData.home_team_color || effectiveGameData.away_team_color);
  const hasAnyTeamColorData = effectiveGameData &&
    (effectiveGameData.home_team_color || effectiveGameData.away_team_color);

  const teamColorForBackground = useTeamColor && teamColorSide && hasRealGameData && !effectiveUseImageTint
    ? getTeamColor(effectiveGameData, teamColorSide)
    : undefined;

  const teamColorForTint = useTeamColor && teamColorSide && hasAnyTeamColorData && effectiveUseImageTint
    ? getTeamColor(effectiveGameData, teamColorSide)
    : undefined;

  const isBannerOrSequence = dataPath === 'user_sequences.banner' || dataPath === 'user_sequences.timeout';
  const effectiveBackgroundColor = isBannerOrSequence ? '#000000' : (teamColorForBackground || backgroundColor);

  // Auto-contrast calculation
  let contrastSourceColor: string | undefined = effectiveBackgroundColor;
  if (autoContrastText && teamColorSide && effectiveGameData) {
    const teamColorForContrast = getTeamColor(effectiveGameData, teamColorSide);
    contrastSourceColor = teamColorForContrast || contrastSourceColor;
  }

  const hasExplicitStateTextColor = canToggle && (
    (effectiveToggleState && state2Props?.textColor) ||
    (!effectiveToggleState && state1Props?.textColor)
  );

  let effectiveTextColor: string;
  if (hasExplicitStateTextColor) {
    effectiveTextColor = textColor;
  } else if (autoContrastText && contrastSourceColor && contrastSourceColor !== 'transparent') {
    effectiveTextColor = getContrastTextColor(contrastSourceColor);
  } else if (teamColorForBackground) {
    effectiveTextColor = '#ffffff';
  } else {
    effectiveTextColor = textColor;
  }

  const effectiveTintColor = effectiveUseImageTint
    ? (teamColorForTint || formatColor(effectiveImageTintColor))
    : undefined;

  // Get the data value
  const rawValue = getNestedData(effectiveGameData, dataPath);
  const isBooleanToggle = canToggle && typeof rawValue === 'boolean';

  // Handle currentPlayer name paths
  const isCurrentPlayerName = dataPath === 'currentPlayer.home.name' || dataPath === 'currentPlayer.away.name';
  const defaultName = dataPath === 'currentPlayer.home.name' ? 'Home' :
                      dataPath === 'currentPlayer.away.name' ? 'Away' : '--';

  // Format value
  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      if (isCurrentPlayerName) return defaultName;
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
  const customText = activeProps.customText;
  const previewText = activeProps.previewText;
  const displayText = customText
    ? `${prefix}${customText}${suffix}`
    : previewText
    ? `${prefix}${previewText}${suffix}`
    : isTimeOfDay
    ? `${prefix}${currentTimeOfDay}${suffix}`
    : ((!dataPath || dataPath.trim() === '' || dataPath === 'none' || isBooleanToggle) ? '' : `${prefix}${formattedValue}${suffix}`);

  // Text alignment helper
  const getJustifyContent = () => {
    switch (textAlign) {
      case 'left': return 'left';
      case 'right': return 'right';
      case 'center':
      default: return 'center';
    }
  };

  // Get image source
  const imageSourceObj = getImageSource(
    imageSource,
    imagePath,
    imageUrl,
    dataPath,
    rawValue,
    mockBannerData,
    currentBannerIndex
  );

  const effectiveObjectFit = isBannerOrSequence ? 'fill' : objectFit;
  const containerWidth = width;
  const containerHeight = height;
  const anchorAlignment = getAnchorAlignment(imageAnchor);

  // Calculate final font size
  const finalFontSize = React.useMemo(() => {
    if (!autoFitText || !displayText || displayText.length === 0) {
      return fontSize;
    }

    const availableWidth = containerWidth - paddingLeft - paddingRight;
    const availableHeight = containerHeight - paddingTop - paddingBottom;
    const charWidthRatio = 0.6;
    const widthBasedFontSize = availableWidth / (displayText.length * charWidthRatio);
    const heightBasedFontSize = availableHeight;

    return Math.min(widthBasedFontSize, heightBasedFontSize, fontSize);
  }, [autoFitText, displayText, fontSize, containerWidth, containerHeight, paddingLeft, paddingRight, paddingTop, paddingBottom]);

  return (
    <View style={{
      width: containerWidth,
      height: containerHeight,
      backgroundColor: effectiveBackgroundColor,
      justifyContent: imageSourceObj ? anchorAlignment.justifyContent : 'flex-start',
      alignItems: imageSourceObj ? anchorAlignment.alignItems : 'flex-start',
      overflow: imageSourceObj ? 'visible' : 'hidden',
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
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      position: 'relative',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 150ms ease-in-out',
      flexDirection: 'column'
    }}>
      {imageSourceObj ? (
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
                fontSize,
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
              <>
                <img
                  key={`preload-${imageSourceObj.uri}-${imageRetryCount}`}
                  src={imageSourceObj.uri}
                  alt=""
                  style={{ display: 'none' }}
                  onError={() => {
                    if (imageRetryCount < maxImageRetries) {
                      setTimeout(() => {
                        setImageRetryCount(prev => prev + 1);
                      }, 500 * (imageRetryCount + 1));
                    }
                  }}
                />
                <div
                  key={`mask-${imageSourceObj.uri}-${imageRetryCount}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: effectiveTintColor,
                    WebkitMaskImage: `url(${imageSourceObj.uri})`,
                    maskImage: `url(${imageSourceObj.uri})`,
                    WebkitMaskSize: effectiveObjectFit === 'none' || effectiveObjectFit === 'fill' ? '100% 100%' : effectiveObjectFit,
                    maskSize: effectiveObjectFit === 'none' || effectiveObjectFit === 'fill' ? '100% 100%' : effectiveObjectFit,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    transform: (flipHorizontal || flipVertical) ? `scale(${flipHorizontal ? -1 : 1}, ${flipVertical ? -1 : 1})` : undefined,
                    transformOrigin: 'center',
                  }}
                />
              </>
            ) : (
              <img
                key={`${imageSourceObj.uri}-${imageRetryCount}`}
                src={imageSourceObj.uri}
                alt={label || 'Custom image'}
                style={{
                  ...(effectiveObjectFit === 'none' ? {
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill'
                  } : {
                    width: '100%',
                    height: '100%',
                    objectFit: effectiveObjectFit
                  }),
                  display: 'block',
                  transform: (flipHorizontal || flipVertical) ? `scale(${flipHorizontal ? -1 : 1}, ${flipVertical ? -1 : 1})` : undefined,
                  transformOrigin: 'center',
                }}
                onLoad={() => {
                  if (imageRetryCount > 0) {
                    setImageRetryCount(0);
                  }
                }}
                onError={(e) => {
                  if (imageRetryCount < maxImageRetries) {
                    setTimeout(() => {
                      setImageRetryCount(prev => prev + 1);
                    }, 500 * (imageRetryCount + 1));
                  } else {
                    e.currentTarget.style.display = 'none';
                  }
                }}
              />
            )}
          </div>
        </>
      ) : (
        <svg
          width={containerWidth}
          height={containerHeight}
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <text
            x={(() => {
              if (textAlign === 'left') return paddingLeft;
              if (textAlign === 'right') return containerWidth - paddingRight;
              return containerWidth / 2;
            })()}
            y="50%"
            dy={getFontConfig(fontFamily).dyOffset}
            textAnchor={textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle'}
            fill={effectiveTextColor}
            fontSize={finalFontSize}
            fontWeight="bold"
            fontFamily={getFontConfig(fontFamily).web}
            letterSpacing="0"
          >
            {displayText}
          </text>
        </svg>
      )}
    </View>
  );
}
