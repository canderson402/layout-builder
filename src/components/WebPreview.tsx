import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ComponentConfig, LayoutConfig } from '../types';
import TeamNameBox from '../shared/components/TeamNameBox';
import ScoreBox from '../shared/components/ScoreBox';
import ClockDisplay from '../shared/components/ClockDisplay';
import FoulsDisplay from '../shared/components/FoulsDisplay';
import CustomDataDisplay from '../shared/components/CustomDataDisplay';
import DynamicList from '../shared/components/DynamicList';
import { ShaderEffectCanvas, DistortionEffectCanvas, GenerativeEffectCanvas, ActiveEffect, isDistortionEffect, isGenerativeEffect } from '../effects';

interface WebPreviewProps {
  layout: LayoutConfig;
  selectedComponents: string[];
  onSelectComponents: (ids: string[]) => void;
  gameData?: any;
  activeEffects?: Map<string, ActiveEffect>;
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

// Calculate effective z-index based on hierarchy (parent layers affect children)
const getEffectiveLayer = (component: ComponentConfig, allComponents: ComponentConfig[]): number => {
  let effectiveLayer = component.layer || 0;
  let parentId = component.parentId;
  let multiplier = 1000; // Each parent level adds this much priority

  while (parentId) {
    const parent = allComponents.find(c => c.id === parentId);
    if (!parent) break;
    // Add parent's layer contribution - higher parent layer = higher z-index for all children
    effectiveLayer += (parent.layer || 0) * multiplier;
    parentId = parent.parentId;
    multiplier *= 1000; // Increase multiplier for deeper nesting
  }

  return effectiveLayer;
};

function WebPreview({ layout, selectedComponents, onSelectComponents, gameData, activeEffects }: WebPreviewProps) {
  // Use provided gameData or fall back to mockGameData
  const effectiveGameData = gameData || mockGameData;

  // Debug: log when activeEffects changes
  React.useEffect(() => {
    if (activeEffects && activeEffects.size > 0) {
      console.log('[WebPreview] activeEffects received:', activeEffects.size, Array.from(activeEffects.keys()));
    }
  }, [activeEffects]);

  // Helper to wrap content with optional shader effect
  const wrapWithEffect = (
    content: React.ReactNode,
    activeEffect: ActiveEffect | undefined,
    baseStyle: React.CSSProperties,
    width: number,
    height: number,
    key: string,
    maskImageUrl?: string
  ) => {
    if (activeEffect) {
      // Use GenerativeEffectCanvas for generative effects (like liquid)
      if (isGenerativeEffect(activeEffect.name) && activeEffect.presetParams) {
        return (
          <div key={key} style={baseStyle}>
            <GenerativeEffectCanvas
              active={true}
              width={width}
              height={height}
              params={activeEffect.presetParams}
              intensity={activeEffect.intensity}
              maskImageUrl={maskImageUrl}
            >
              {content}
            </GenerativeEffectCanvas>
          </div>
        );
      }

      // Use DistortionEffectCanvas for distortion effects (texture-based)
      // Use ShaderEffectCanvas for overlay effects (additive)
      const EffectComponent = isDistortionEffect(activeEffect.name)
        ? DistortionEffectCanvas
        : ShaderEffectCanvas;

      return (
        <div key={key} style={baseStyle}>
          <EffectComponent
            effect={activeEffect.name}
            active={true}
            progress={activeEffect.progress}
            intensity={activeEffect.intensity}
            primaryColor={activeEffect.primaryColor}
            secondaryColor={activeEffect.secondaryColor}
            center={activeEffect.center}
            width={width}
            height={height}
          >
            {content}
          </EffectComponent>
        </div>
      );
    }

    return (
      <div key={key} style={baseStyle}>
        {content}
      </div>
    );
  };

  const renderComponent = (config: ComponentConfig, index: number, effectiveLayer: number) => {
    // Check if there's an active effect on this component
    const activeEffect = activeEffects?.get(config.id);

    const { type, position, size, props, team, id } = config;

    // Positions and sizes are already in pixels
    const left = position.x;
    const top = position.y;
    const width = size.width;
    const height = size.height;

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      top,
      width,
      height,
      zIndex: effectiveLayer,  // Use effective layer that considers parent hierarchy
    };

    // Use component ID as key for stable identity
    const componentKey = id;

    switch (type) {
      case 'dynamicList':
        return wrapWithEffect(
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
          />,
          activeEffect,
          baseStyle,
          width,
          height,
          componentKey
        );

      case 'custom':
        return wrapWithEffect(
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
            imageTintColor={props.imageTintColor}
            useImageTint={props.useImageTint}
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
            autoFitText={props.autoFitText}
            minFontScale={props.minFontScale}
            previewText={props.previewText}
            fontFamily={props.fontFamily}
          />,
          activeEffect,
          baseStyle,
          width,
          height,
          componentKey,
          props.imageUrl || props.imagePath  // Pass image URL for alpha mask
        );

      default:
        // For other component types, show a placeholder
        const placeholderBgColor = props?.backgroundColor || 'rgba(100, 100, 100, 0.5)';
        const placeholderTextColor = props?.textColor || '#fff';

        return wrapWithEffect(
          <div
            style={{
              width: '100%',
              height: '100%',
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
          </div>,
          activeEffect,
          baseStyle,
          width,
          height,
          componentKey
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
        .filter(component => {
          // Don't show hidden components
          if (component.visible === false) return false;
          // Don't render layers/groups - they're organizational only
          if (component.type === 'group') return false;
          // Don't show if any ancestor is hidden
          let parentId = component.parentId;
          while (parentId) {
            const parent = (layout.components || []).find(c => c.id === parentId);
            if (!parent) break;
            if (parent.visible === false) return false;
            parentId = parent.parentId;
          }
          return true;
        })
        .map(component => ({
          component,
          effectiveLayer: getEffectiveLayer(component, layout.components || [])
        }))
        .sort((a, b) => a.effectiveLayer - b.effectiveLayer)
        .map(({ component, effectiveLayer }, index) => renderComponent(component, index, effectiveLayer))}
    </View>
  );
}

export default WebPreview;