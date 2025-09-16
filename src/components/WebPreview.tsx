import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ComponentConfig, LayoutConfig } from '../types';
import TeamNameBox from '../shared/components/TeamNameBox';
import ScoreBox from '../shared/components/ScoreBox';
import ClockDisplay from '../shared/components/ClockDisplay';
import FoulsDisplay from '../shared/components/FoulsDisplay';
import CustomDataDisplay from '../shared/components/CustomDataDisplay';
import DynamicList from '../shared/components/DynamicList';

interface WebPreviewProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
  gameData?: any;
}

// Mock game data for preview
const mockGameData = {
  homeTeam: {
    name: 'HOME TEAM',
    score: 1,
    color: '#c41e3a',
    fouls: 7,
  },
  awayTeam: {
    name: 'AWAY TEAM',
    score: 0,
    color: '#003f7f',
    fouls: 5,
  },
  gameClock: '5:42.3',
  period: 4,
};

function WebPreview({ layout, selectedComponents, onSelectComponents, gameData }: WebPreviewProps) {
  // Use provided gameData or fall back to mockGameData
  const effectiveGameData = gameData || mockGameData;
  const renderComponent = (config: ComponentConfig, index: number) => {
    const { type, position, size, props, team, id } = config;
    
    // Positions and sizes are already in pixels
    const left = position.x;
    const top = position.y;
    const width = size.width;
    const height = size.height;
    
    const baseStyle = {
      position: 'absolute' as const,
      left,
      top,
      width,
      height,
      zIndex: config.layer || 0,  // Ensure proper layering
    };

    const TouchableWrapper = ({ children }: { children: React.ReactNode }) => (
      <div style={baseStyle}>
        {children}
      </div>
    );

    switch (type) {
      case 'dynamicList':
        return (
          <TouchableWrapper key={index}>
            <DynamicList
              totalCountPath={props.totalCountPath}
              activeCountPath={props.activeCountPath}
              totalCount={props.totalCount}
              activeCount={props.activeCount}
              activeBackgroundColor={props.activeBackgroundColor}
              activeTextColor={props.activeTextColor}
              activeBorderColor={props.activeBorderColor}
              activeBorderWidth={props.activeBorderWidth}
              inactiveBackgroundColor={props.inactiveBackgroundColor}
              inactiveTextColor={props.inactiveTextColor}
              inactiveBorderColor={props.inactiveBorderColor}
              inactiveBorderWidth={props.inactiveBorderWidth}
              direction={props.direction}
              itemSpacing={props.itemSpacing}
              borderRadius={props.borderRadius}
              showNumbers={props.showNumbers}
              reverseOrder={props.reverseOrder}
              borderWidth={props.borderWidth}
              borderColor={props.borderColor}
              width={width}
              height={height}
              gameData={effectiveGameData}
            />
          </TouchableWrapper>
        );

      case 'custom':
        return (
          <TouchableWrapper key={index}>
            <CustomDataDisplay
              dataPath={props.dataPath || ''}
              gameData={effectiveGameData}
              label={props.label}
              backgroundColor={props.backgroundColor}
              textColor={props.textColor}
              width={width}
              height={height}
              fontSize={props.fontSize || 24}
              format={props.format || 'text'}
              prefix={props.prefix || ''}
              suffix={props.suffix || ''}
              textAlign={props.textAlign}
              paddingTop={props.paddingTop}
              paddingRight={props.paddingRight}
              paddingBottom={props.paddingBottom}
              paddingLeft={props.paddingLeft}
              imageSource={props.imageSource}
              imagePath={props.imagePath}
              imageUrl={props.imageUrl}
              objectFit={props.objectFit || 'fill'}
              imageAnchor={props.imageAnchor || 'center'}
              useTeamColor={config.useTeamColor}
              teamColorSide={config.teamColorSide}
              canToggle={props.canToggle}
              toggleState={props.toggleState}
              state1Props={props.state1Props}
              state2Props={props.state2Props}
              autoToggle={props.autoToggle}
              borderWidth={props.borderWidth}
              borderColor={props.borderColor}
              borderStyle={props.borderStyle}
              borderTopWidth={props.borderTopWidth}
              borderRightWidth={props.borderRightWidth}
              borderBottomWidth={props.borderBottomWidth}
              borderLeftWidth={props.borderLeftWidth}
              borderTopLeftRadius={props.borderTopLeftRadius}
              borderTopRightRadius={props.borderTopRightRadius}
              borderBottomLeftRadius={props.borderBottomLeftRadius}
              borderBottomRightRadius={props.borderBottomRightRadius}
            />
          </TouchableWrapper>
        );

      default:
        // For other component types, show a placeholder
        const placeholderBgColor = props?.backgroundColor || 'rgba(100, 100, 100, 0.5)';
        const placeholderTextColor = props?.textColor || '#fff';
        
        return (
          <div 
            key={index} 
            style={{
              ...baseStyle,
              backgroundColor: placeholderBgColor,
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            <Text style={{ color: placeholderTextColor, fontSize: 12, textAlign: 'center' }}>
              {type}
              {team && ` (${team})`}
            </Text>
          </div>
        );
    }
  };

  return (
    <View 
      style={{
        width: layout.dimensions.width,
        height: layout.dimensions.height,
        backgroundColor: layout.backgroundColor,
        position: 'relative',
      }}
    >
      {[...(layout.components || [])]
        .filter(component => component.visible !== false) // Only show visible components
        .sort((a, b) => (a.layer || 0) - (b.layer || 0))
        .map((component, index) => renderComponent(component, index))}
    </View>
  );
}

export default WebPreview;