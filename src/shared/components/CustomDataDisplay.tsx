import React from 'react';
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
}

// Mock data for preview in layout builder
const mockData = {
  homeTeam: {
    name: 'HOME',
    score: 87,
    fouls: 4,
    timeouts: 3,
    bonus: true,
    possession: true
  },
  awayTeam: {
    name: 'AWAY',
    score: 92,
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
  objectFit = 'fill'
}: CustomDataDisplayProps) {
  
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
  const displayText = !dataPath || dataPath.trim() === '' ? 'Select Data' : `${prefix}${formattedValue}${suffix}`;

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

  return (
    <View style={{
      width,
      height,
      backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: imageSourceObj ? 0 : 1, // No border for images
      borderColor: 'rgba(255, 255, 255, 0.3)',
      paddingTop: paddingTop + (imageSourceObj ? 0 : 4), // No extra padding for images
      paddingRight: paddingRight + (imageSourceObj ? 0 : 4),
      paddingBottom: paddingBottom + (imageSourceObj ? 0 : 4),
      paddingLeft: paddingLeft + (imageSourceObj ? 0 : 4),
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
              flex: 1,
              width: objectFit === 'none' ? 'auto' : '100%',
              height: objectFit === 'none' ? 'auto' : '100%',
              objectFit: objectFit, // Use the passed objectFit value
              display: 'block',
              ...(objectFit === 'none' && {
                // For native resolution, center the image in the container
                maxWidth: '100%',
                maxHeight: '100%'
              })
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