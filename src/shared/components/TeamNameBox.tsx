import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const vw = screenWidth / 100;

interface TeamNameBoxProps {
  teamName: string;
  teamColor: string;
  position?: 'left' | 'right';
  width?: number;
  height?: number;
  fontSize?: number;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}

export default function TeamNameBox({ 
  teamName, 
  teamColor, 
  position = 'left',
  width = vw * 30,
  height = vw * 8,
  fontSize = vw * 3,
  textColor = '#ffffff',
  textAlign = 'center',
  paddingTop = 0,
  paddingRight = 0,
  paddingBottom = 0,
  paddingLeft = 0
}: TeamNameBoxProps) {
  // Convert textAlign to flexbox alignment for container
  const getJustifyContent = () => {
    switch (textAlign) {
      case 'left': return 'flex-start';
      case 'right': return 'flex-end';
      case 'center':
      default: return 'center';
    }
  };

  return (
    <View style={[
      styles.container,
      { 
        width, 
        height,
        backgroundColor: teamColor,
        justifyContent: getJustifyContent(),
        alignItems: 'center', // Keep vertical centering
        flexDirection: 'row', // Make it horizontal layout
        paddingTop: paddingTop + 2,
        paddingRight: paddingRight + 2,
        paddingBottom: paddingBottom + 2,
        paddingLeft: paddingLeft + 2,
      }
    ]}>
      <Text style={[styles.text, { fontSize, color: textColor }]}>
        {teamName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  text: {
    color: '#ffffff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});