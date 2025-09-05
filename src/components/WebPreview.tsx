import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ComponentConfig, LayoutConfig } from '../types';
import TeamNameBox from '../shared/components/TeamNameBox';
import ScoreBox from '../shared/components/ScoreBox';
import ClockDisplay from '../shared/components/ClockDisplay';
import FoulsDisplay from '../shared/components/FoulsDisplay';
import CustomDataDisplay from '../shared/components/CustomDataDisplay';

interface WebPreviewProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
}

// Mock game data for preview
const mockGameData = {
  homeTeam: {
    name: 'HOME TEAM',
    score: 87,
    color: '#c41e3a',
    fouls: 7,
  },
  awayTeam: {
    name: 'AWAY TEAM',
    score: 92,
    color: '#003f7f',
    fouls: 5,
  },
  gameClock: '5:42.3',
  period: 4,
};

function WebPreview({ layout, selectedComponents, onSelectComponents }: WebPreviewProps) {
  // Helper function to convert percentage to pixels
  const percentToPixels = (percent: number, total: number) => (percent / 100) * total;

  const renderComponent = (config: ComponentConfig, index: number) => {
    const { type, position, size, props, team, id } = config;
    
    // Convert percentage-based positioning to pixels for display
    // Use correct dimensions: width for X/width, height for Y/height
    const left = percentToPixels(position.x, layout.dimensions.width);
    const top = percentToPixels(position.y, layout.dimensions.height);
    const width = percentToPixels(size.width, layout.dimensions.width);
    const height = percentToPixels(size.height, layout.dimensions.height);
    
    const baseStyle = {
      position: 'absolute' as const,
      left,
      top,
      width,
      height,
      boxSizing: 'border-box' as const,  // Include border in width/height
      borderTopWidth: props?.borderTopWidth !== undefined ? props.borderTopWidth : (props?.borderWidth || 1),
      borderRightWidth: props?.borderRightWidth !== undefined ? props.borderRightWidth : (props?.borderWidth || 1),
      borderBottomWidth: props?.borderBottomWidth !== undefined ? props.borderBottomWidth : (props?.borderWidth || 1),
      borderLeftWidth: props?.borderLeftWidth !== undefined ? props.borderLeftWidth : (props?.borderWidth || 1),
      borderStyle: props?.borderStyle || 'solid',
      borderColor: props?.borderColor || 'rgba(255, 255, 255, 0.3)',
      boxShadow: selectedComponents.includes(id) ? '0 0 0 3px #4CAF50' : 'none',
      borderTopLeftRadius: props?.borderTopLeftRadius || 0,
      borderTopRightRadius: props?.borderTopRightRadius || 0,
      borderBottomLeftRadius: props?.borderBottomLeftRadius || 0,
      borderBottomRightRadius: props?.borderBottomRightRadius || 0,
      overflow: 'hidden' as const,  // Ensure background respects border radius
    };

    const TouchableWrapper = ({ children }: { children: React.ReactNode }) => (
      <div style={baseStyle}>
        {children}
      </div>
    );

    switch (type) {
      case 'teamName':
        const teamData = team === 'home' ? mockGameData.homeTeam : mockGameData.awayTeam;
        return (
          <TouchableWrapper key={index}>
            <TeamNameBox
              teamName={teamData.name}
              teamColor={teamData.color}
              position={team === 'home' ? 'left' : 'right'}
              width={width}
              height={height}
              textAlign={props.textAlign}
              paddingTop={props.paddingTop}
              paddingRight={props.paddingRight}
              paddingBottom={props.paddingBottom}
              paddingLeft={props.paddingLeft}
              {...props}
            />
          </TouchableWrapper>
        );
        
      case 'score':
        const scoreData = team === 'home' ? mockGameData.homeTeam : mockGameData.awayTeam;
        return (
          <TouchableWrapper key={index}>
            <ScoreBox
              score={scoreData.score}
              width={width}
              height={height}
              {...props}
            />
          </TouchableWrapper>
        );
        
      case 'clock':
        return (
          <TouchableWrapper key={index}>
            <ClockDisplay
              time={mockGameData.gameClock}
              width={width}
              height={height}
              {...props}
            />
          </TouchableWrapper>
        );
        
      case 'fouls':
        const foulsData = team === 'home' ? mockGameData.homeTeam : mockGameData.awayTeam;
        return (
          <TouchableWrapper key={index}>
            <FoulsDisplay
              fouls={foulsData.fouls}
              position={team === 'home' ? 'left' : 'right'}
              width={width}
              height={height}
              {...props}
            />
          </TouchableWrapper>
        );
        
      case 'custom':
        return (
          <TouchableWrapper key={index}>
            <CustomDataDisplay
              dataPath={props.dataPath || ''}
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
            />
          </TouchableWrapper>
        );

      default:
        // For other component types, show a placeholder
        return (
          <div 
            key={index} 
            style={{
              ...baseStyle,
              backgroundColor: 'rgba(100, 100, 100, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>
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
      {[...layout.components]
        .filter(component => component.visible !== false) // Only show visible components
        .sort((a, b) => (a.layer || 0) - (b.layer || 0))
        .map((component, index) => renderComponent(component, index))}
    </View>
  );
}

export default WebPreview;