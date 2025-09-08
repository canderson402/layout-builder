import React, { useState } from 'react';
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
}

// Mock data for preview in layout builder
const mockData = {
  homeTeam: {
    name: 'HOME',
    score: 1,
    fouls: 4,
    timeouts: 3,
    bonus: true,
    possession: true
  },
  awayTeam: {
    name: 'AWAY',
    score: 0,
    fouls: 6,
    timeouts: 2,
    bonus: false,
    possession: false
  },
  gameClock: '5:42',
  period: 4,
  shotClock: 14,
  quarter: 4,
  half: 2,
  set: 3,
  isOvertime: false
};

export default function CustomDataDisplay({
  dataPath = 'gameClock',
  gameData = mockData,
  label,
  backgroundColor = '#000000',
  textColor = '#ffffff',
  width = 100,
  height = 50,
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
  imageAnchor = 'center'
}: CustomDataDisplayProps) {
  
  // State to track image natural dimensions for native resolution mode
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  // Helper function to get nested data using dot notation
  const getNestedData = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Get the data value
  const rawValue = getNestedData(gameData, dataPath);
  
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
  const displayText = !dataPath || dataPath.trim() === '' || dataPath === 'none' ? '' : `${prefix}${formattedValue}${suffix}`;

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
    if (imageSource === 'local' && imagePath) {
      return { uri: imagePath };
    }
    if (imageSource === 'url' && imageUrl) {
      return { uri: imageUrl };
    }
    return null;
  };

  const imageSourceObj = getImageSource();
  
  // For native resolution mode, use image dimensions only if they match the current width/height
  // If user manually resizes, respect their manual size to allow anchor positioning
  const shouldAutoSize = objectFit === 'none' && imageDimensions && 
    (width === imageDimensions.width && height === imageDimensions.height);
  const containerWidth = shouldAutoSize ? imageDimensions.width : width;
  const containerHeight = shouldAutoSize ? imageDimensions.height : height;

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
  
  // Debug logging
  if (imageSourceObj) {
    console.log('CustomDataDisplay anchor debug:', {
      imageAnchor,
      anchorAlignment,
      objectFit,
      containerWidth,
      containerHeight
    });
  }

  return (
    <View style={{
      width: containerWidth,
      height: containerHeight,
      backgroundColor,
      justifyContent: imageSourceObj ? anchorAlignment.justifyContent : 'center',
      alignItems: imageSourceObj ? anchorAlignment.alignItems : 'center',
      borderWidth: imageSourceObj ? 0 : 1, // No border for images
      borderColor: 'rgba(255, 255, 255, 0.3)',
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
                color: textColor,
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {label}
              </Text>
            </View>
          )}
          <img
            src={imageSourceObj.uri}
            alt={label || 'Custom image'}
            style={{
              ...(objectFit === 'none' ? {
                // Native resolution - let container anchor determine positioning
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto'
              } : {
                // Fill modes - image fills container completely
                width: '100%',
                height: '100%'
              }),
              objectFit: objectFit,
              display: 'block'
            }}
            onLoad={(e) => {
              // Capture image natural dimensions for native resolution mode
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
                color: textColor,
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
        color: textColor,
        opacity: 0.5,
        position: 'absolute',
        bottom: 2,
        right: 2
      }}>
        {imageSourceObj ? 'Image' : (dataPath || 'No data selected')}
      </Text>
    </View>
  );
}