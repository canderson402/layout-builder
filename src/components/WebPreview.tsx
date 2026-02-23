import React from 'react';
import { Text } from 'react-native';
import { ComponentConfig, LayoutConfig } from '../types';
import TeamNameBox from '../shared/components/TeamNameBox';
import ScoreBox from '../shared/components/ScoreBox';
import ClockDisplay from '../shared/components/ClockDisplay';
import FoulsDisplay from '../shared/components/FoulsDisplay';
import CustomDataDisplay from '../shared/components/CustomDataDisplay';
import DynamicList from '../shared/components/DynamicList';
import LeaderboardList from '../shared/components/LeaderboardList';
import { getTemplate } from '../utils/slotTemplates';

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
  // Mock penalty slots for lacrosse/hockey preview - all slots have test data
  penaltySlots: {
    home: {
      count: 3,
      isState0: false,
      isState1: false,
      isState2: false,
      isState3: true,
      slot0: { jersey: 90, time: '0:45', active: true },
      slot1: { jersey: 3, time: '1:30', active: true },
      slot2: { jersey: 17, time: '2:15', active: true },
    },
    away: {
      count: 3,
      isState0: false,
      isState1: false,
      isState2: false,
      isState3: true,
      slot0: { jersey: 14, time: '1:00', active: true },
      slot1: { jersey: 22, time: '1:45', active: true },
      slot2: { jersey: 8, time: '2:30', active: true },
    },
  },
  // Mock leaderboard slots for preview
  leaderboardSlots: {
    home: {
      count: 5,
      isState0: false,
      isState1: false,
      isState2: false,
      isState3: false,
      isState4: false,
      isState5: true,
      slot0: { jersey: 23, name: 'M. JORDAN', points: 32, fouls: 2, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_home_1.png' },
      slot1: { jersey: 33, name: 'S. PIPPEN', points: 18, fouls: 3, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_home_2.png' },
      slot2: { jersey: 91, name: 'D. RODMAN', points: 8, fouls: 4, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_home_3.png' },
      slot3: { jersey: 7, name: 'T. KUKOC', points: 12, fouls: 1, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_home_4.png' },
      slot4: { jersey: 25, name: 'S. KERR', points: 6, fouls: 0, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_home_5.png' },
      // currentPlayer = slot0 (updates when cycling)
      currentPlayer: { jersey: 23, name: 'M. JORDAN', points: 32, fouls: 2, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_home_1.png' },
    },
    away: {
      count: 5,
      isState0: false,
      isState1: false,
      isState2: false,
      isState3: false,
      isState4: false,
      isState5: true,
      slot0: { jersey: 32, name: 'K. MALONE', points: 28, fouls: 3, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_away_1.png' },
      slot1: { jersey: 12, name: 'J. STOCKTON', points: 14, fouls: 2, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_away_2.png' },
      slot2: { jersey: 4, name: 'B. RUSSELL', points: 10, fouls: 1, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_away_3.png' },
      slot3: { jersey: 14, name: 'J. HORNACEK', points: 8, fouls: 2, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_away_4.png' },
      slot4: { jersey: 55, name: 'G. OSTERTAG', points: 4, fouls: 4, isTopScorer: false, active: true, imageUrl: '/images/test_leaderboard/player_away_5.png' },
      // currentPlayer = slot0 (updates when cycling)
      currentPlayer: { jersey: 32, name: 'K. MALONE', points: 28, fouls: 3, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_away_1.png' },
    },
  },
  // Top-level currentPlayer for convenience
  currentPlayer: {
    home: { jersey: 23, name: 'M. JORDAN', points: 32, fouls: 2, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_home_1.png' },
    away: { jersey: 32, name: 'K. MALONE', points: 28, fouls: 3, isTopScorer: true, active: true, imageUrl: '/images/test_leaderboard/player_away_1.png' },
  },
};

// Helper function to get nested data using dot notation
const getNestedData = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
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

// Check if a component's ancestors are visible (for hard visibility cutoff)
const areAncestorsVisible = (
  component: ComponentConfig,
  allComponents: ComponentConfig[],
  gameData: any
): boolean => {
  // Check all ancestors' visibilityPaths (for groups that control child visibility)
  let parentId = component.parentId;
  while (parentId) {
    const parent = allComponents.find(c => c.id === parentId);
    if (!parent) break;

    // If parent has visibilityPath set, check if it evaluates to true
    if (parent.props?.visibilityPath) {
      const visibilityValue = getNestedData(gameData, parent.props.visibilityPath);
      if (typeof visibilityValue === 'boolean' && !visibilityValue) {
        return false;
      }
    }

    parentId = parent.parentId;
  }

  return true;
};

// Get the visibility value for a component's own visibilityPath (for smooth opacity transitions)
const getComponentVisibility = (
  component: ComponentConfig,
  gameData: any
): boolean => {
  if (component.props?.visibilityPath) {
    const visibilityValue = getNestedData(gameData, component.props.visibilityPath);
    if (typeof visibilityValue === 'boolean') {
      return visibilityValue;
    }
  }
  return true;
};

function WebPreview({ layout, selectedComponents, onSelectComponents, gameData }: WebPreviewProps) {
  // Use provided gameData or fall back to mockGameData
  const effectiveGameData = gameData || mockGameData;

  // Helper to wrap content in a positioned div
  const wrapContent = (
    content: React.ReactNode,
    baseStyle: React.CSSProperties,
    key: string
  ) => {
    return (
      <div key={key} style={baseStyle}>
        {content}
      </div>
    );
  };

  const renderComponent = (config: ComponentConfig, index: number, effectiveLayer: number, isVisible: boolean = true) => {
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
      isolation: 'isolate',  // Create stacking context to contain borders
    };

    // Use component ID as key for stable identity
    const componentKey = id;

    switch (type) {
      case 'dynamicList':
        return wrapContent(
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
          baseStyle,
          componentKey
        );

      case 'custom': {
        // Apply border to wrapper div to prevent z-index separation issues with react-native-web
        const customBaseStyle: React.CSSProperties = {
          ...baseStyle,
          boxSizing: 'border-box',
          borderWidth: props.borderWidth || 0,
          borderColor: props.borderColor || 'transparent',
          borderStyle: props.borderStyle || 'solid',
          borderTopWidth: props.borderTopWidth ?? props.borderWidth ?? 0,
          borderRightWidth: props.borderRightWidth ?? props.borderWidth ?? 0,
          borderBottomWidth: props.borderBottomWidth ?? props.borderWidth ?? 0,
          borderLeftWidth: props.borderLeftWidth ?? props.borderWidth ?? 0,
          borderTopLeftRadius: props.borderTopLeftRadius || 0,
          borderTopRightRadius: props.borderTopRightRadius || 0,
          borderBottomLeftRadius: props.borderBottomLeftRadius || 0,
          borderBottomRightRadius: props.borderBottomRightRadius || 0,
          overflow: 'hidden',  // Clip content to border radius
        };
        return wrapContent(
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
            customText={props.customText}
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
            flipHorizontal={props.flipHorizontal}
            flipVertical={props.flipVertical}
            imageTintColor={props.imageTintColor}
            useImageTint={props.useImageTint}
            useTeamColor={config.useTeamColor}
            teamColorSide={config.teamColorSide}
            canToggle={props.canToggle}
            toggleState={props.toggleState}
            state1Props={props.state1Props}
            state2Props={props.state2Props}
            autoToggle={props.autoToggle}
            visibilityPath={props.visibilityPath}
            multiStateEnabled={props.multiStateEnabled}
            statePath={props.statePath}
            stateImages={props.stateImages}
            borderWidth={0}
            borderColor={'transparent'}
            borderStyle={'solid'}
            borderTopWidth={0}
            borderRightWidth={0}
            borderBottomWidth={0}
            borderLeftWidth={0}
            borderTopLeftRadius={0}
            borderTopRightRadius={0}
            borderBottomLeftRadius={0}
            borderBottomRightRadius={0}
            autoFitText={props.autoFitText}
            minFontScale={props.minFontScale}
            previewText={props.previewText}
            fontFamily={props.fontFamily}
            autoContrastText={props.autoContrastText}
            isVisible={isVisible}
          />,
          customBaseStyle,
          componentKey
        );
      }

      case 'leaderboardList':
        return wrapContent(
          <LeaderboardList
            team={team || 'home'}
            maxVisible={props.maxVisible || 5}
            slotHeight={props.slotHeight || 60}
            slotSpacing={props.slotSpacing || 5}
            highlightColor={props.highlightColor || '#FFD700'}
            textColor={props.textColor || '#ffffff'}
            fontSize={props.fontSize || 24}
            backgroundColor={props.backgroundColor || 'transparent'}
            showJersey={props.showJersey !== false}
            showName={props.showName !== false}
            showPoints={props.showPoints !== false}
            showFouls={props.showFouls || false}
            width={width}
            height={height}
            gameData={effectiveGameData}
            mockPlayers={props.mockPlayers}
            cycleEnabled={props.cycleEnabled || false}
            cycleInterval={props.cycleInterval || 5000}
          />,
          baseStyle,
          componentKey
        );

      case 'slotList': {
        // Render the actual template components for preview
        const template = props.templateId ? getTemplate(props.templateId) : null;
        const slotCount = props.slotCount || 5;
        const slotSpacing = props.slotSpacing || 5;
        const direction = props.direction || 'vertical';
        const teamLabel = props.team || 'home';
        const prefix = props.dataPathPrefix || 'leaderboardSlots';
        const hideInactiveSlots = props.hideInactiveSlots || false;

        // If no template selected, show placeholder
        if (!template) {
          return wrapContent(
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                border: '2px dashed #2196F3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ color: '#2196F3', fontSize: 12, fontWeight: 'bold' }}>
                SLOT LIST
              </div>
              <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
                Select a template
              </div>
            </div>,
            baseStyle,
            componentKey
          );
        }

        // Calculate natural size of all slots combined (no scaling - use native pixel sizes)
        const naturalWidth = direction === 'horizontal'
          ? slotCount * template.slotSize.width + (slotCount - 1) * slotSpacing
          : template.slotSize.width;
        const naturalHeight = direction === 'vertical'
          ? slotCount * template.slotSize.height + (slotCount - 1) * slotSpacing
          : template.slotSize.height;

        // Render actual template components for each slot
        const slotElements: React.ReactNode[] = [];
        let visibleSlotIndex = 0; // Track position for visible slots (stacks consecutively)

        for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
          // Check if slot is active (when hideInactiveSlots is enabled)
          if (hideInactiveSlots) {
            const slotData = getNestedData(effectiveGameData, `${prefix}.${teamLabel}.slot${slotIndex}`);
            if (!slotData?.active) {
              continue; // Skip this slot - it's not active
            }
          }

          // Calculate offset based on visible slot position (not original index)
          // This ensures slots stack consecutively without gaps
          // No scaling - use native pixel sizes, spacing pushes slots down/right
          const offsetX = direction === 'horizontal' ? visibleSlotIndex * (template.slotSize.width + slotSpacing) : 0;
          const offsetY = direction === 'vertical' ? visibleSlotIndex * (template.slotSize.height + slotSpacing) : 0;
          visibleSlotIndex++;

          // Render each component in the template (skip groups - they're organizational only)
          template.components.filter(c => c.type !== 'group').forEach((templateComp, compIndex) => {
            // Create a preview component with native positions and sizes (no scaling)
            const previewComp: ComponentConfig = {
              ...templateComp,
              id: `${config.id}-slot${slotIndex}-comp${compIndex}`,
              position: {
                x: templateComp.position.x + offsetX,
                y: templateComp.position.y + offsetY,
              },
              size: {
                width: templateComp.size.width,
                height: templateComp.size.height,
              },
              props: templateComp.props ? { ...templateComp.props } : {},
            };

            // Prefix data paths for preview
            if (previewComp.props?.dataPath && previewComp.props.dataPath !== 'none') {
              previewComp.props.dataPath = `${prefix}.${teamLabel}.slot${slotIndex}.${previewComp.props.dataPath}`;
            }
            if (previewComp.props?.visibilityPath) {
              previewComp.props.visibilityPath = `${prefix}.${teamLabel}.slot${slotIndex}.${previewComp.props.visibilityPath}`;
            }

            // Render the component - use template's layer + base effectiveLayer for proper z-ordering
            const componentLayer = effectiveLayer + (templateComp.layer || 0);
            const compElement = renderComponent(previewComp, slotIndex * 100 + compIndex, componentLayer, true);
            slotElements.push(compElement);
          });
        }

        // Use natural size for the container - spacing expands the bounding box
        return (
          <div key={componentKey} style={{
            ...baseStyle,
            width: naturalWidth,
            height: naturalHeight,
            overflow: 'visible'
          }}>
            {slotElements}
          </div>
        );
      }

      default:
        // For other component types, show a placeholder
        const placeholderBgColor = props?.backgroundColor || 'rgba(100, 100, 100, 0.5)';
        const placeholderTextColor = props?.textColor || '#fff';

        return wrapContent(
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
          baseStyle,
          componentKey
        );
    }
  };

  // Sort components by effective layer to ensure correct DOM order AND z-index
  const sortedComponents = [...(layout.components || [])]
    .filter(component => {
      // Don't show hidden components
      if (component.visible === false) return false;
      // Don't render layers/groups - they're organizational only
      if (component.type === 'group') return false;
      // Don't show if any ancestor is hidden (including static visibility)
      let parentId = component.parentId;
      while (parentId) {
        const parent = (layout.components || []).find(c => c.id === parentId);
        if (!parent) break;
        if (parent.visible === false) return false;
        parentId = parent.parentId;
      }
      // Don't show if ancestor has visibilityPath that evaluates to false
      // (component's own visibilityPath is handled via opacity for smooth transitions)
      if (!areAncestorsVisible(component, layout.components || [], effectiveGameData)) {
        return false;
      }
      return true;
    })
    .map(component => ({
      component,
      effectiveLayer: getEffectiveLayer(component, layout.components || []),
      isVisible: getComponentVisibility(component, effectiveGameData)
    }))
    .sort((a, b) => a.effectiveLayer - b.effectiveLayer);

  return (
    <div
      style={{
        width: layout.dimensions.width,
        height: layout.dimensions.height,
        backgroundColor: 'transparent', // Canvas handles background color/image
        position: 'relative',
        // Establish a stacking context for all children
        isolation: 'isolate',
      }}
    >
      {sortedComponents.map(({ component, effectiveLayer, isVisible }, index) =>
        renderComponent(component, index, effectiveLayer, isVisible)
      )}
    </div>
  );
}

export default WebPreview;