import React from 'react';
import { View, Text } from 'react-native';

interface DynamicListProps {
  // Data paths
  totalCountPath?: string; // Path to total count (e.g., 'timeoutsAllowed')
  activeCountPath?: string; // Path to active/remaining count (e.g., 'homeTeam.timeouts')

  // Static values (fallback if no data paths)
  totalCount?: number;
  activeCount?: number;

  // Styling for active items
  activeBackgroundColor?: string;
  activeTextColor?: string;

  // Styling for inactive items
  inactiveBackgroundColor?: string;
  inactiveTextColor?: string;

  // Layout
  direction?: 'horizontal' | 'vertical';
  itemAlignment?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  itemSpacing?: number;
  borderRadius?: number;
  showNumbers?: boolean; // Show numbers in each item
  reverseOrder?: boolean; // For timeouts: true = active items on left, false = active items on right

  // Shared border properties (override individual border settings)
  borderWidth?: number;
  borderColor?: string;

  // Container size
  width: number;
  height: number;

  // Game data
  gameData?: any;
}

// Mock data for preview in layout builder
const mockData = {
  timeoutsAllowed: 5,
  maxFouls: 7,
  homeTeam: {
    timeouts: 2,
    fouls: 4
  },
  awayTeam: {
    timeouts: 3,
    fouls: 2
  },
  gameUpdate: {
    timeouts_allowed: 5
  }
};

export default function DynamicList(props: DynamicListProps) {
  const {
    totalCountPath,
    activeCountPath,
    totalCount = 5,
    activeCount = 2,
    activeBackgroundColor = '#4CAF50',
    activeTextColor = '#ffffff',
    inactiveBackgroundColor = '#666666',
    inactiveTextColor = '#ffffff',
    direction = 'horizontal',
    itemAlignment = 'start',
    itemSpacing = 4,
    borderRadius = 4,
    showNumbers = false,
    reverseOrder = false,
    borderWidth,
    borderColor,
    width,
    height,
    gameData
  } = props;

  // Map alignment values to flexbox justifyContent
  const getJustifyContent = (alignment: string) => {
    switch (alignment) {
      case 'start': return 'flex-start';
      case 'center': return 'center';
      case 'end': return 'flex-end';
      case 'space-between': return 'space-between';
      case 'space-around': return 'space-around';
      default: return 'flex-start';
    }
  };

  // Use provided gameData or fall back to mockData
  const effectiveGameData = gameData || mockData;

  // Helper function to get nested data using dot notation
  const getNestedData = (obj: any, path: string) => {
    if (!path) return null;
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Get dynamic counts from data paths or use static values
  // For total count: prioritize data path value, only fall back to static if no data path is set
  const effectiveTotalCount = totalCountPath ?
    getNestedData(effectiveGameData, totalCountPath) ?? totalCount :
    totalCount;

  // For active count: prioritize data path value, only fall back to static if no data path is set
  const effectiveActiveCount = activeCountPath ?
    getNestedData(effectiveGameData, activeCountPath) ?? activeCount :
    activeCount;

  // Ensure counts are valid numbers
  const safeTotal = Math.max(1, Math.floor(Number(effectiveTotalCount) || 1));
  const safeActive = Math.max(0, Math.min(safeTotal, Math.floor(Number(effectiveActiveCount) || 0)));

  // Calculate item dimensions
  const isHorizontal = direction === 'horizontal';
  const totalSpacing = (safeTotal - 1) * itemSpacing;
  const shouldFillContainer = itemAlignment === 'start';

  let itemWidth: number;
  let itemHeight: number;

  if (isHorizontal) {
    if (shouldFillContainer) {
      // Fill the container width with items
      itemWidth = Math.floor((width - totalSpacing) / safeTotal);
      itemHeight = height;
    } else {
      // Use square items based on height so they can be centered
      itemHeight = height;
      itemWidth = height; // Square items
    }
  } else {
    if (shouldFillContainer) {
      // Fill the container height with items
      itemWidth = width;
      itemHeight = Math.floor((height - totalSpacing) / safeTotal);
    } else {
      // Use square items based on width so they can be centered
      itemWidth = width;
      itemHeight = width; // Square items
    }
  }

  // Generate items array
  const items = Array.from({ length: safeTotal }, (_, index) => {
    const itemNumber = index + 1;

    // Determine if this item should be active
    let isActive: boolean;
    if (reverseOrder) {
      // Active items on the right/bottom (reverse order)
      isActive = index >= (safeTotal - safeActive);
    } else {
      // Active items on the left/top (normal order)
      isActive = index < safeActive;
    }

    return {
      index,
      itemNumber,
      isActive
    };
  });

  return (
    <View style={{
      width,
      height,
      flexDirection: isHorizontal ? 'row' : 'column',
      justifyContent: getJustifyContent(itemAlignment),
      alignItems: shouldFillContainer ? 'stretch' : 'center',
      gap: itemSpacing
    }}>
      {items.map(({ index, itemNumber, isActive }) => (
        <View
          key={index}
          style={{
            // Use flex: 1 when filling container to avoid rounding gaps
            ...(shouldFillContainer ? { flex: 1 } : { width: itemWidth }),
            height: isHorizontal ? itemHeight : (shouldFillContainer ? undefined : itemHeight),
            backgroundColor: isActive ? activeBackgroundColor : inactiveBackgroundColor,
            borderWidth: borderWidth || 0,
            borderColor: borderColor || '#ffffff',
            borderRadius,
            borderStyle: 'solid',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {showNumbers && (
            <Text style={{
              color: isActive ? activeTextColor : inactiveTextColor,
              fontSize: Math.min(itemWidth, itemHeight) * 0.4,
              fontWeight: 'bold'
            }}>
              {itemNumber}
            </Text>
          )}
        </View>
      ))}

      {/* Debug info */}
      <Text style={{
        fontSize: 8,
        color: '#666',
        opacity: 0.7,
        position: 'absolute',
        bottom: -15,
        left: 0
      }}>
        {safeActive}/{safeTotal} {activeCountPath || 'active'}
      </Text>
    </View>
  );
}