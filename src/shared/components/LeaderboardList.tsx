import React, { useState, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';

interface LeaderboardPlayer {
  id: string;
  jersey: string;
  name: string;
  points: number;
  fouls: number;
  isTopScorer: boolean;
}

interface LeaderboardListProps {
  team: 'home' | 'away';
  maxVisible: number;
  slotHeight: number;
  slotSpacing: number;
  highlightColor: string;
  textColor: string;
  fontSize: number;
  backgroundColor: string;
  showJersey: boolean;
  showName: boolean;
  showPoints: boolean;
  showFouls: boolean;
  width: number;
  height: number;
  gameData?: any;
  mockPlayers?: LeaderboardPlayer[];
  cycleEnabled?: boolean;
  cycleInterval?: number;
}

const defaultMockPlayers: LeaderboardPlayer[] = [
  { id: '1', jersey: '23', name: 'Jordan', points: 32, fouls: 2, isTopScorer: true },
  { id: '2', jersey: '33', name: 'Pippen', points: 24, fouls: 1, isTopScorer: false },
  { id: '3', jersey: '91', name: 'Rodman', points: 18, fouls: 3, isTopScorer: false },
  { id: '4', jersey: '7', name: 'Kukoc', points: 14, fouls: 0, isTopScorer: false },
  { id: '5', jersey: '25', name: 'Kerr', points: 10, fouls: 1, isTopScorer: false },
  { id: '6', jersey: '54', name: 'Grant', points: 8, fouls: 2, isTopScorer: false },
  { id: '7', jersey: '24', name: 'Harper', points: 6, fouls: 1, isTopScorer: false },
  { id: '8', jersey: '13', name: 'Longley', points: 4, fouls: 2, isTopScorer: false },
];

export default function LeaderboardList({
  team,
  maxVisible = 5,
  slotHeight = 60,
  slotSpacing = 8,
  highlightColor = '#FFD700',
  textColor = '#ffffff',
  fontSize = 24,
  backgroundColor = 'transparent',
  showJersey = true,
  showName = true,
  showPoints = true,
  showFouls = false,
  width,
  height,
  gameData,
  mockPlayers,
  cycleEnabled = false,
  cycleInterval = 5000,
}: LeaderboardListProps) {
  const [visibleWindow, setVisibleWindow] = useState(0);

  const leaderboardData = gameData?.leaderboard;
  const cycleData = gameData?.leaderboardCycle;
  const teamColor = team === 'home'
    ? gameData?.homeTeam?.color || '#c41e3a'
    : gameData?.awayTeam?.color || '#003f7f';

  // Use cycle settings from gameData if available, otherwise use props
  const effectiveCycleEnabled = cycleData?.enabled ?? cycleEnabled;
  const effectiveCycleInterval = cycleData?.interval ?? cycleInterval;

  const players = useMemo(() => {
    if (mockPlayers && mockPlayers.length > 0) {
      return mockPlayers;
    }
    return leaderboardData?.[team]?.players || defaultMockPlayers;
  }, [leaderboardData, team, mockPlayers]);

  const visiblePlayers = useMemo(() => {
    if (players.length <= maxVisible) {
      return players;
    }
    const startIndex = (visibleWindow * maxVisible) % players.length;
    const endIndex = Math.min(startIndex + maxVisible, players.length);
    return players.slice(startIndex, endIndex);
  }, [players, visibleWindow, maxVisible]);

  useEffect(() => {
    if (!effectiveCycleEnabled || players.length <= maxVisible) {
      return;
    }

    const timer = setInterval(() => {
      setVisibleWindow(prev => {
        const totalWindows = Math.ceil(players.length / maxVisible);
        return (prev + 1) % totalWindows;
      });
    }, effectiveCycleInterval);

    return () => clearInterval(timer);
  }, [effectiveCycleEnabled, effectiveCycleInterval, players.length, maxVisible]);

  useEffect(() => {
    if (!effectiveCycleEnabled) {
      setVisibleWindow(0);
    }
  }, [effectiveCycleEnabled]);

  return (
    <View style={{
      width,
      height,
      backgroundColor,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {visiblePlayers.map((player, index) => {
        const yPosition = index * (slotHeight + slotSpacing);

        return (
          <View
            key={player.id}
            style={{
              position: 'absolute',
              top: yPosition,
              left: 0,
              right: 0,
              height: slotHeight,
              flexDirection: 'row',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Top scorer highlight */}
            {player.isTopScorer && (
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: highlightColor,
                opacity: 0.3,
              }} />
            )}

            {/* Row background */}
            <View style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 4,
            }} />

            {/* Content */}
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              zIndex: 1,
            }}>
              {showJersey && (
                <Text style={{
                  width: 50,
                  color: textColor,
                  fontSize,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}>
                  {player.jersey}
                </Text>
              )}
              {showName && (
                <Text style={{
                  flex: 1,
                  color: textColor,
                  fontSize,
                  fontWeight: '600',
                }} numberOfLines={1}>
                  {player.name}
                </Text>
              )}
              {showPoints && (
                <Text style={{
                  width: 50,
                  color: textColor,
                  fontSize,
                  fontWeight: 'bold',
                  textAlign: 'right',
                }}>
                  {player.points}
                </Text>
              )}
              {showFouls && (
                <Text style={{
                  width: 50,
                  color: textColor,
                  fontSize,
                  fontWeight: 'bold',
                  textAlign: 'right',
                }}>
                  {player.fouls}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Debug info */}
      <Text style={{
        fontSize: 8,
        color: '#666',
        opacity: 0.7,
        position: 'absolute',
        bottom: -15,
        left: 0,
      }}>
        {team} leaderboard ({visiblePlayers.length}/{players.length} visible)
        {effectiveCycleEnabled && ` - cycling window ${visibleWindow + 1}/${Math.ceil(players.length / maxVisible)}`}
      </Text>
    </View>
  );
}
